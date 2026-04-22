import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import {
  defaultLoadMarkdownRenderer,
} from "./quickPreviewRenderers/markdownRenderer";
import {
  defaultLoadNotebookRenderer,
} from "./quickPreviewRenderers/notebookRenderer";
import { defaultLoadPptxRenderer } from "./quickPreviewRenderers/pptxRenderer";
import { defaultLoadHwpxRenderer } from "./quickPreviewRenderers/hwpxRenderer";
import { defaultLoadXlsxRenderer } from "./quickPreviewRenderers/xlsxRenderer";
import {
  MAX_NOTEBOOK_BYTES,
  MarkdownRendererModule,
  NotebookRendererModule,
  PptxRendererModule,
  HwpxRendererModule,
  XlsxRendererModule,
  TextHighlighterModule,
} from "./quickPreviewRenderers/shared";
import { defaultLoadTextHighlighter } from "./quickPreviewRenderers/textHighlighter";

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

type InvokeImpl = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

interface DocxRendererModule {
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

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "ico",
  "tiff",
  "avif",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "mov",
  "mkv",
  "avi",
  "m4v",
]);

const RENDER_EXTENSIONS = new Set(["md", "markdown", "html", "htm"]);
const NOTEBOOK_EXTENSIONS = new Set(["ipynb"]);
const PDF_EXTENSIONS = new Set(["pdf"]);
const PPTX_EXTENSIONS = new Set(["pptx"]);
const HWPX_EXTENSIONS = new Set(["hwpx"]);
const XLSX_EXTENSIONS = new Set(["xlsx", "xls"]);
const DOCX_EXTENSIONS = new Set(["docx"]);

const TEXT_EXTENSIONS = new Set([
  "txt",
  "json",
  "jsonc",
  "ts",
  "tsx",
  "js",
  "jsx",
  "css",
  "scss",
  "sass",
  "less",
  "xml",
  "yaml",
  "yml",
  "toml",
  "rs",
  "py",
  "r",
  "go",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "sh",
  "bash",
  "zsh",
  "fish",
  "env",
  "gitignore",
  "gitattributes",
  "editorconfig",
  "lock",
  "log",
  "csv",
  "sql",
  "graphql",
  "gql",
  "vue",
  "svelte",
  "astro",
  "ini",
  "cfg",
  "conf",
  "config",
  "makefile",
]);

export const getExtension = (path: string): string => {
  const fileName = path.split(/[\\/]/).pop() ?? "";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex < 0) {
    return "";
  }

  return fileName.slice(dotIndex + 1).toLowerCase();
};

export const getFileName = (path: string): string =>
  path.split(/[\\/]/).pop() ?? path;

const fetchPreviewText = async (
  path: string,
  fetchImpl: typeof fetch,
  convertFileSrcImpl: (path: string) => string
) => {
  const url = convertFileSrcImpl(path);
  const response = await fetchImpl(url);
  const contentLength = response.headers.get("content-length");

  if (contentLength && Number.parseInt(contentLength, 10) > MAX_NOTEBOOK_BYTES) {
    throw new Error("파일이 너무 큽니다 (5MB 초과). 미리보기를 지원하지 않습니다.");
  }

  const content = await response.text();
  if (content.length > MAX_NOTEBOOK_BYTES) {
    throw new Error("파일이 너무 큽니다 (5MB 초과). 미리보기를 지원하지 않습니다.");
  }

  return content;
};

const defaultLoadDocxRenderer = async (): Promise<DocxRendererModule> => {
  const { renderDocx } = await import("./quickPreviewDocxRenderer");

  return {
    renderDocx: (filePath) => renderDocx(filePath),
  };
};

export const loadSourceHighlightHtml = async (
  content: string,
  renderExt: string,
  options: Pick<QuickPreviewLoaderOptions, "loadTextHighlighter"> = {}
) => {
  const loadTextHighlighter = options.loadTextHighlighter ?? defaultLoadTextHighlighter;
  const highlighter = await loadTextHighlighter();
  return highlighter.highlightSource(content, renderExt);
};

export const loadPreviewForPath = async (
  path: string,
  options: QuickPreviewLoaderOptions = {}
): Promise<PreviewState> => {
  const extension = getExtension(path);
  const invokeImpl = options.invokeImpl ?? invoke;
  const convertFileSrcImpl = options.convertFileSrcImpl ?? convertFileSrc;
  const fetchImpl = options.fetchImpl ?? fetch;
  const loadTextHighlighter = options.loadTextHighlighter ?? defaultLoadTextHighlighter;
  const loadMarkdownRenderer = options.loadMarkdownRenderer ?? defaultLoadMarkdownRenderer;
  const loadNotebookRenderer = options.loadNotebookRenderer ?? defaultLoadNotebookRenderer;
  const loadPptxRenderer = options.loadPptxRenderer ?? defaultLoadPptxRenderer;
  const loadHwpxRenderer = options.loadHwpxRenderer ?? defaultLoadHwpxRenderer;
  const loadXlsxRenderer = options.loadXlsxRenderer ?? defaultLoadXlsxRenderer;
  const loadDocxRenderer = options.loadDocxRenderer ?? defaultLoadDocxRenderer;

  if (IMAGE_EXTENSIONS.has(extension)) {
    return {
      type: "image",
      src: convertFileSrcImpl(path),
    };
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return {
      type: "video",
      src: convertFileSrcImpl(path),
    };
  }

  if (PDF_EXTENSIONS.has(extension)) {
    return {
      type: "pdf",
      src: convertFileSrcImpl(path),
    };
  }

  if (PPTX_EXTENSIONS.has(extension)) {
    const renderer = await loadPptxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderPptx(path),
      renderExt: "pptx",
    };
  }

  if (HWPX_EXTENSIONS.has(extension)) {
    const renderer = await loadHwpxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderHwpx(path),
      renderExt: "hwpx",
    };
  }

  if (XLSX_EXTENSIONS.has(extension)) {
    const renderer = await loadXlsxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderXlsx(path),
      renderExt: extension,
    };
  }

  if (DOCX_EXTENSIONS.has(extension)) {
    const renderer = await loadDocxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderDocx(path),
      renderExt: "docx",
    };
  }

  if (NOTEBOOK_EXTENSIONS.has(extension)) {
    const content = await fetchPreviewText(path, fetchImpl, convertFileSrcImpl);
    const renderer = await loadNotebookRenderer();
    return {
      type: "rendered",
      content,
      renderedHtml: await renderer.renderNotebook(content),
      renderExt: "ipynb",
    };
  }

  if (RENDER_EXTENSIONS.has(extension)) {
    const content = await invokeImpl<string>("read_file_content", { path });

    if (extension === "md" || extension === "markdown") {
      const renderer = await loadMarkdownRenderer();
      return {
        type: "rendered",
        content,
        renderedHtml: await renderer.renderMarkdown(content),
        renderExt: "markdown",
      };
    }

    return {
      type: "rendered",
      content,
      renderedHtml: content,
      renderExt: "html",
    };
  }

  if (TEXT_EXTENSIONS.has(extension) || extension === "") {
    const content = await invokeImpl<string>("read_file_content", { path });
    const highlighter = await loadTextHighlighter();
    const highlighted = await highlighter.highlightText(content, extension);

    return highlighted
      ? {
          type: "text",
          content,
          highlightedHtml: highlighted.highlightedHtml,
          language: highlighted.language,
        }
      : {
          type: "text",
          content,
        };
  }

  return {
    type: "unsupported",
  };
};
