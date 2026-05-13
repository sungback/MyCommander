import type {
  HwpxRendererModule,
  MarkdownRendererModule,
  NotebookRendererModule,
  PptxRendererModule,
  TextHighlighterModule,
  XlsxRendererModule,
} from "./quickPreviewRenderers/shared";

export type PreviewType =
  | "image"
  | "video"
  | "pdf"
  | "text"
  | "rendered"
  | "unsupported"
  | "loading"
  | "error";

export interface PreviewState {
  type: PreviewType;
  content?: string;
  highlightedHtml?: string;
  renderedHtml?: string;
  language?: string;
  src?: string;
  error?: string;
  renderExt?: string;
}

export type InvokeImpl = <T>(
  command: string,
  args?: Record<string, unknown>
) => Promise<T>;

export interface DocxRendererModule {
  renderDocx: (filePath: string) => Promise<string>;
}

export interface QuickPreviewLoaderOptions {
  convertFileSrcImpl?: (path: string) => string;
  invokeImpl?: InvokeImpl;
  fetchImpl?: typeof fetch;
  loadTextHighlighter?: () => Promise<TextHighlighterModule>;
  loadMarkdownRenderer?: () => Promise<MarkdownRendererModule>;
  loadNotebookRenderer?: () => Promise<NotebookRendererModule>;
  loadPptxRenderer?: () => Promise<PptxRendererModule>;
  loadHwpxRenderer?: () => Promise<HwpxRendererModule>;
  loadXlsxRenderer?: () => Promise<XlsxRendererModule>;
  loadDocxRenderer?: () => Promise<DocxRendererModule>;
}
