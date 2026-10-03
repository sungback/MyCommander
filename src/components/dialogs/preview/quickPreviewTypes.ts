import type {
  HwpxRendererModule,
  MarkdownRendererModule,
  NotebookRendererModule,
  PptxRendererModule,
  SqliteRendererModule,
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
  readFileContent?: (path: string, maxBytes?: number) => Promise<string>;
  readFileBinary?: (path: string, maxBytes?: number) => Promise<ArrayBuffer | Uint8Array>;
  loadTextHighlighter?: () => Promise<TextHighlighterModule>;
  loadMarkdownRenderer?: () => Promise<MarkdownRendererModule>;
  loadNotebookRenderer?: () => Promise<NotebookRendererModule>;
  loadPptxRenderer?: () => Promise<PptxRendererModule>;
  loadHwpxRenderer?: () => Promise<HwpxRendererModule>;
  loadXlsxRenderer?: () => Promise<XlsxRendererModule>;
  loadSqliteRenderer?: () => Promise<SqliteRendererModule>;
  loadDocxRenderer?: () => Promise<DocxRendererModule>;
}
