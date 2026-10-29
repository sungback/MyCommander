import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type {
  PdfDocumentHandle,
  PdfLoadingTask,
  PdfRendererModule,
  PdfSource,
} from "./pdfTypes";

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * pdf.js가 작업자 스레드에서 받아 오는 리소스(CMap, 표준 글꼴, WebAssembly 대체 JS)의 위치.
 * vite.config.ts의 pdfjs 리소스 플러그인이 같은 출처의 `/pdfjs/` 아래에서 제공한다.
 */
const getResourceUrl = (directory: string) =>
  new URL(`${import.meta.env.BASE_URL}pdfjs/${directory}/`, window.location.href).href;

const createDocumentHandle = (
  document: PDFDocumentProxy,
  loadingTask: PDFDocumentLoadingTask
): PdfDocumentHandle => ({
  numPages: document.numPages,
  getPageSize: async (pageNumber) => {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    return { width: viewport.width, height: viewport.height };
  },
  renderPage: (pageNumber, canvas, scale) => {
    let renderTask: RenderTask | null = null;
    let cancelled = false;

    const promise = document.getPage(pageNumber).then(async (page) => {
      if (cancelled) {
        return;
      }

      const viewport = page.getViewport({ scale });
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      renderTask = page.render({ canvas, viewport });
      await renderTask.promise;
    });

    return {
      promise,
      cancel: () => {
        cancelled = true;
        renderTask?.cancel();
      },
    };
  },
  // 문서와 작업자 스레드는 불러온 작업을 정리할 때 함께 해제된다.
  destroy: () => {
    void loadingTask.destroy();
  },
});

const openPdf = (source: PdfSource): PdfLoadingTask => {
  const loadingTask: PDFDocumentLoadingTask = getDocument({
    ...("url" in source ? { url: source.url } : { data: source.data }),
    cMapUrl: getResourceUrl("cmaps"),
    cMapPacked: true,
    standardFontDataUrl: getResourceUrl("standard_fonts"),
    wasmUrl: getResourceUrl("wasm"),
    // CSP(script-src 'self')는 WebAssembly 컴파일을 허용하지 않으므로,
    // 이미지 해독(JPEG 2000, JBIG2)은 같은 출처의 JS 대체 모듈을 쓴다.
    useWasm: false,
  });

  return {
    promise: loadingTask.promise.then((document) =>
      createDocumentHandle(document, loadingTask)
    ),
    cancel: () => {
      void loadingTask.destroy();
    },
  };
};

export const pdfRenderer: PdfRendererModule = { openPdf };
