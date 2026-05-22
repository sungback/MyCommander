import {
  DOCX_EXTENSIONS,
  HWPX_EXTENSIONS,
  IMAGE_EXTENSIONS,
  NOTEBOOK_EXTENSIONS,
  PDF_EXTENSIONS,
  PPTX_EXTENSIONS,
  RENDER_EXTENSIONS,
  SQLITE_EXTENSIONS,
  TEXT_EXTENSIONS,
  VIDEO_EXTENSIONS,
  XLSX_EXTENSIONS,
} from "./quickPreviewFileTypes";
import { MAX_NOTEBOOK_BYTES } from "./quickPreviewRenderers/shared";
import type {
  DocxRendererModule,
  PreviewState,
  QuickPreviewLoaderOptions,
} from "./quickPreviewTypes";

export interface QuickPreviewHandlerContext
  extends Required<
    Omit<QuickPreviewLoaderOptions, "invokeImpl" | "convertFileSrcImpl" | "fetchImpl">
  > {
  extension: string;
  convertFileSrcImpl: (path: string) => string;
  readFileContent: (path: string, maxBytes?: number) => Promise<string>;
  loadDocxRenderer: () => Promise<DocxRendererModule>;
}

type QuickPreviewHandler = (
  path: string,
  context: QuickPreviewHandlerContext
) => Promise<PreviewState | null>;

const assetPreviewHandler: QuickPreviewHandler = async (path, context) => {
  if (IMAGE_EXTENSIONS.has(context.extension)) {
    return {
      type: "image",
      src: context.convertFileSrcImpl(path),
    };
  }

  if (VIDEO_EXTENSIONS.has(context.extension)) {
    return {
      type: "video",
      src: context.convertFileSrcImpl(path),
    };
  }

  if (PDF_EXTENSIONS.has(context.extension)) {
    return {
      type: "pdf",
      src: context.convertFileSrcImpl(path),
    };
  }

  return null;
};

const officePreviewHandler: QuickPreviewHandler = async (path, context) => {
  if (PPTX_EXTENSIONS.has(context.extension)) {
    const renderer = await context.loadPptxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderPptx(path),
      renderExt: "pptx",
    };
  }

  if (HWPX_EXTENSIONS.has(context.extension)) {
    const renderer = await context.loadHwpxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderHwpx(path),
      renderExt: "hwpx",
    };
  }

  if (XLSX_EXTENSIONS.has(context.extension)) {
    const renderer = await context.loadXlsxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderXlsx(path),
      renderExt: context.extension,
    };
  }

  if (DOCX_EXTENSIONS.has(context.extension)) {
    const renderer = await context.loadDocxRenderer();
    return {
      type: "rendered",
      renderedHtml: await renderer.renderDocx(path),
      renderExt: "docx",
    };
  }

  return null;
};

const sqlitePreviewHandler: QuickPreviewHandler = async (path, context) => {
  if (!SQLITE_EXTENSIONS.has(context.extension)) {
    return null;
  }

  const renderer = await context.loadSqliteRenderer();
  return {
    type: "rendered",
    renderedHtml: await renderer.renderSqlite(path),
    renderExt: "sqlite",
  };
};

const notebookPreviewHandler: QuickPreviewHandler = async (path, context) => {
  if (!NOTEBOOK_EXTENSIONS.has(context.extension)) {
    return null;
  }

  const content = await context.readFileContent(path, MAX_NOTEBOOK_BYTES);
  const renderer = await context.loadNotebookRenderer();
  return {
    type: "rendered",
    content,
    renderedHtml: await renderer.renderNotebook(content),
    renderExt: "ipynb",
  };
};

const renderedTextPreviewHandler: QuickPreviewHandler = async (path, context) => {
  if (!RENDER_EXTENSIONS.has(context.extension)) {
    return null;
  }

  const content = await context.readFileContent(path);

  if (context.extension === "md" || context.extension === "markdown") {
    const renderer = await context.loadMarkdownRenderer();
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
};

const textPreviewHandler: QuickPreviewHandler = async (path, context) => {
  if (!TEXT_EXTENSIONS.has(context.extension) && context.extension !== "") {
    return null;
  }

  const content = await context.readFileContent(path);
  const highlighter = await context.loadTextHighlighter();
  const highlighted = await highlighter.highlightText(content, context.extension);

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
};

export const QUICK_PREVIEW_HANDLERS: QuickPreviewHandler[] = [
  assetPreviewHandler,
  officePreviewHandler,
  sqlitePreviewHandler,
  notebookPreviewHandler,
  renderedTextPreviewHandler,
  textPreviewHandler,
];

export const loadPreviewFromHandlers = async (
  path: string,
  context: QuickPreviewHandlerContext
): Promise<PreviewState> => {
  for (const handler of QUICK_PREVIEW_HANDLERS) {
    const preview = await handler(path, context);
    if (preview) {
      return preview;
    }
  }

  return { type: "unsupported" };
};
