/** 배율 1에서의 페이지 크기(CSS 픽셀). */
export interface PdfPageSize {
  width: number;
  height: number;
}

export interface PdfRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

/** 열린 PDF 문서. pdf.js 객체를 감춰 화면 코드와 테스트가 pdf.js에 직접 의존하지 않게 한다. */
export interface PdfDocumentHandle {
  numPages: number;
  getPageSize: (pageNumber: number) => Promise<PdfPageSize>;
  /** `scale`(화면 배율 포함)로 페이지를 그린다. 캔버스 픽셀 크기도 이 함수가 맞춘다. */
  renderPage: (pageNumber: number, canvas: HTMLCanvasElement, scale: number) => PdfRenderTask;
  destroy: () => void;
}

export interface PdfLoadingTask {
  promise: Promise<PdfDocumentHandle>;
  cancel: () => void;
}

export type PdfSource = { url: string } | { data: Uint8Array };

export interface PdfRendererModule {
  openPdf: (source: PdfSource) => PdfLoadingTask;
}
