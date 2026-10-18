import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useFileSystem } from "../../../../hooks/useFileSystem";
import { PagedPreviewLayout, THUMBNAIL_WIDTH } from "../paged/PagedPreviewLayout";
import { getFitScale } from "../paged/pageNavigation";
import {
  createRenderLimiter,
  isPdfPasswordError,
  isPdfRenderCancelled,
  type RenderLimiter,
} from "./pdfPreviewHelpers";
import type {
  PdfDocumentHandle,
  PdfLoadingTask,
  PdfPageSize,
  PdfRendererModule,
} from "./pdfTypes";

const THUMBNAIL_RENDER_CONCURRENCY = 2;
const PAGE_PADDING = 24;

const defaultLoadPdfRenderer = async (): Promise<PdfRendererModule> =>
  (await import("./pdfDocument")).pdfRenderer;

const getDevicePixelRatio = () =>
  typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);

const toUint8Array = (bytes: ArrayBuffer | Uint8Array) =>
  bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

type PdfLoadState =
  | { kind: "loading" }
  | { kind: "ready"; document: PdfDocumentHandle; firstPageSize: PdfPageSize }
  | { kind: "error"; reason: "password" | "failed"; detail: string };

interface QuickPreviewPdfViewProps {
  /** asset 프로토콜 URL */
  src: string;
  filePath: string;
  loadRenderer?: () => Promise<PdfRendererModule>;
  readFileBinary?: (path: string) => Promise<ArrayBuffer | Uint8Array>;
}

/**
 * PDF 빠른 미리보기. 왼쪽에 페이지 썸네일, 오른쪽에 현재 페이지 한 장을 보여 주고
 * 화살표·PageUp/PageDown·Home/End로 페이지를 넘긴다. 열 수 없는 문서는 웹뷰 내장 뷰어로 볼 수 있게 한다.
 */
export const QuickPreviewPdfView: React.FC<QuickPreviewPdfViewProps> = ({
  src,
  filePath,
  loadRenderer = defaultLoadPdfRenderer,
  readFileBinary,
}) => {
  const { readFileBinary: fsReadFileBinary } = useFileSystem();
  const readBinary = readFileBinary ?? fsReadFileBinary;
  const [loadState, setLoadState] = useState<PdfLoadState>({ kind: "loading" });
  const [showNativeViewer, setShowNativeViewer] = useState(false);

  useEffect(() => {
    let disposed = false;
    // 정리 함수에서 진행 중인 열기 작업이나 열린 문서를 해제하기 위해 보관한다.
    const handles: { task: PdfLoadingTask | null; document: PdfDocumentHandle | null } = {
      task: null,
      document: null,
    };
    setLoadState({ kind: "loading" });
    setShowNativeViewer(false);

    const openDocument = (renderer: PdfRendererModule, source: Parameters<PdfRendererModule["openPdf"]>[0]) => {
      handles.task = renderer.openPdf(source);
      return handles.task.promise;
    };

    void (async () => {
      try {
        const renderer = await loadRenderer();
        if (disposed) {
          return;
        }

        let document: PdfDocumentHandle;
        try {
          document = await openDocument(renderer, { url: src });
        } catch (error) {
          if (disposed || isPdfPasswordError(error)) {
            throw error;
          }
          // asset 허용 범위 밖 경로 등으로 URL을 열지 못하면 파일 내용을 직접 읽어 다시 연다.
          handles.task?.cancel();
          const bytes = await readBinary(filePath);
          if (disposed) {
            return;
          }
          document = await openDocument(renderer, { data: toUint8Array(bytes) });
        }

        if (disposed) {
          document.destroy();
          return;
        }
        handles.document = document;
        const firstPageSize = await document.getPageSize(1);
        if (!disposed) {
          setLoadState({ kind: "ready", document, firstPageSize });
        }
      } catch (error) {
        if (!disposed) {
          setLoadState({
            kind: "error",
            reason: isPdfPasswordError(error) ? "password" : "failed",
            detail: getErrorMessage(error),
          });
        }
      }
    })();

    return () => {
      disposed = true;
      // 문서를 닫으면 불러온 작업과 작업자 스레드가 함께 정리된다.
      if (handles.document) {
        handles.document.destroy();
      } else {
        handles.task?.cancel();
      }
    };
  }, [src, filePath, loadRenderer, readBinary]);

  const readyDocument = loadState.kind === "ready" ? loadState.document : null;
  // 문서마다 동시에 그리는 썸네일 수를 제한한다.
  const limiter = useMemo(
    () => createRenderLimiter(THUMBNAIL_RENDER_CONCURRENCY),
    [readyDocument]
  );
  const renderPage = useCallback(
    (pageNumber: number) =>
      readyDocument ? <PdfPageView document={readyDocument} pageNumber={pageNumber} /> : null,
    [readyDocument]
  );
  const renderThumbnail = useCallback(
    (pageNumber: number) =>
      readyDocument ? (
        <PdfThumbnailImage document={readyDocument} pageNumber={pageNumber} limiter={limiter} />
      ) : null,
    [limiter, readyDocument]
  );

  if (showNativeViewer) {
    return <iframe src={src} className="w-full flex-1 border-none" title="PDF preview" />;
  }

  if (loadState.kind === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-text-secondary">
        <Loader2 size={24} className="animate-spin" />
        <p className="text-sm">PDF를 여는 중입니다</p>
      </div>
    );
  }

  if (loadState.kind === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-text-secondary">
        <AlertCircle size={24} className="text-red-500" />
        <p className="text-sm font-medium text-text-primary">
          {loadState.reason === "password"
            ? "암호가 걸린 PDF입니다"
            : "PDF를 열지 못했습니다"}
        </p>
        <p className="text-xs">
          {loadState.reason === "password"
            ? "기본 뷰어로 열어 보세요."
            : "파일이 손상되었거나 지원하지 않는 형식일 수 있습니다."}
        </p>
        {loadState.reason === "failed" && (
          <p className="max-w-md break-all font-mono text-xs text-red-400">{loadState.detail}</p>
        )}
        <button
          type="button"
          onClick={() => setShowNativeViewer(true)}
          className="mt-1 px-3 py-1 text-xs rounded border border-border-color text-text-primary hover:bg-bg-hover transition-colors"
        >
          기본 뷰어로 보기
        </button>
      </div>
    );
  }

  const { firstPageSize } = loadState;
  return (
    <PagedPreviewLayout
      key={src}
      pageCount={loadState.document.numPages}
      thumbnailAspectRatio={firstPageSize.height / Math.max(firstPageSize.width, 1)}
      thumbnailLabel={(pageNumber) => `${pageNumber}페이지로 이동`}
      renderPage={renderPage}
      renderThumbnail={renderThumbnail}
      toolbarActions={
        <button
          type="button"
          onClick={() => setShowNativeViewer(true)}
          className="hover:text-text-primary underline-offset-2 hover:underline"
        >
          기본 뷰어로 보기
        </button>
      }
    />
  );
};

interface PdfPageViewProps {
  document: PdfDocumentHandle;
  pageNumber: number;
}

/** 현재 페이지 한 장을 영역에 맞춰 그린다. 페이지가 바뀌거나 크기가 바뀌면 진행 중인 렌더링을 취소한다. */
const PdfPageView: React.FC<PdfPageViewProps> = ({ document, pageNumber }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [areaSize, setAreaSize] = useState<{ width: number; height: number } | null>(null);
  const [pageSize, setPageSize] = useState<PdfPageSize | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const measure = () =>
      setAreaSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    setPageSize(null);
    setRenderError(null);
    document
      .getPageSize(pageNumber)
      .then((size) => {
        if (!disposed) {
          setPageSize(size);
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setRenderError(getErrorMessage(error));
        }
      });

    return () => {
      disposed = true;
    };
  }, [document, pageNumber]);

  const scale = pageSize && areaSize
    ? getFitScale(
        pageSize,
        areaSize.width - PAGE_PADDING * 2,
        areaSize.height - PAGE_PADDING * 2
      )
    : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || scale === null) {
      return;
    }

    const task = document.renderPage(pageNumber, canvas, scale * getDevicePixelRatio());
    task.promise.catch((error: unknown) => {
      if (!isPdfRenderCancelled(error)) {
        setRenderError(getErrorMessage(error));
      }
    });

    return () => task.cancel();
  }, [document, pageNumber, scale]);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 min-h-0 items-center justify-center overflow-hidden bg-bg-secondary"
    >
      {renderError ? (
        <p className="px-6 text-center text-xs text-red-400">
          페이지를 그리지 못했습니다: {renderError}
        </p>
      ) : (
        <canvas
          ref={canvasRef}
          aria-label={`${pageNumber}페이지`}
          className="bg-white shadow-lg"
          style={
            pageSize && scale !== null
              ? { width: pageSize.width * scale, height: pageSize.height * scale }
              : { visibility: "hidden" }
          }
        />
      )}
    </div>
  );
};

interface PdfThumbnailImageProps {
  document: PdfDocumentHandle;
  pageNumber: number;
  limiter: RenderLimiter;
}

/** 썸네일 한 장을 그린다. 그린 결과는 PNG 객체 URL로 바꿔 캔버스 메모리를 돌려준다. */
const PdfThumbnailImage: React.FC<PdfThumbnailImageProps> = ({ document, pageNumber, limiter }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cancelRender: (() => void) | null = null;
    let createdUrl: string | null = null;

    void limiter.run(async () => {
      const size = await document.getPageSize(pageNumber);
      if (cancelled) {
        return;
      }

      const canvas = window.document.createElement("canvas");
      const task = document.renderPage(
        pageNumber,
        canvas,
        (THUMBNAIL_WIDTH / Math.max(size.width, 1)) * getDevicePixelRatio()
      );
      cancelRender = task.cancel;
      try {
        await task.promise;
      } catch (error) {
        if (!isPdfRenderCancelled(error)) {
          console.error(`PDF thumbnail ${pageNumber} failed:`, error);
        }
        return;
      }

      createdUrl = await canvasToObjectUrl(canvas);
      if (cancelled) {
        if (createdUrl) {
          URL.revokeObjectURL(createdUrl);
        }
        return;
      }
      setImageUrl(createdUrl);
    }, () => cancelled);

    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [document, limiter, pageNumber]);

  useEffect(
    () => () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    },
    [imageUrl]
  );

  return imageUrl ? (
    <img
      src={imageUrl}
      alt=""
      className="block h-full w-full object-contain"
      draggable={false}
    />
  ) : null;
};

/** 캔버스를 PNG 객체 URL로 바꾼다. 지원하지 않는 환경이면 null. */
const canvasToObjectUrl = (canvas: HTMLCanvasElement) =>
  new Promise<string | null>((resolve) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(null);
      return;
    }

    try {
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/png");
    } catch {
      resolve(null);
    }
  });
