import { convertFileSrc } from "@tauri-apps/api/core";
import { useFileSystem } from "../../hooks/useFileSystem";
import {
  type MarkdownRendererModule,
  type NotebookRendererModule,
  type PptxRendererModule,
  type HwpxRendererModule,
  type XlsxRendererModule,
  type TextHighlighterModule,
} from "./quickPreviewRenderers/shared";
import { getExtension } from "./quickPreviewFileTypes";
import { loadPreviewFromHandlers } from "./quickPreviewHandlers";
import type {
  DocxRendererModule,
  PreviewState,
  QuickPreviewLoaderOptions,
  PreviewType,
} from "./quickPreviewTypes";

export { getExtension, getFileName } from "./quickPreviewFileTypes";
export type { PreviewState, PreviewType, QuickPreviewLoaderOptions };

const defaultLoadDocxRenderer = async (): Promise<DocxRendererModule> => {
  const { renderDocx } = await import("./quickPreviewDocxRenderer");

  return {
    renderDocx: (filePath) => renderDocx(filePath),
  };
};

const defaultLoadTextHighlighter = async (): Promise<TextHighlighterModule> => {
  const { defaultLoadTextHighlighter: loadRenderer } = await import(
    "./quickPreviewRenderers/textHighlighter"
  );

  return loadRenderer();
};

const defaultLoadMarkdownRenderer = async (): Promise<MarkdownRendererModule> => {
  const { defaultLoadMarkdownRenderer: loadRenderer } = await import(
    "./quickPreviewRenderers/markdownRenderer"
  );

  return loadRenderer();
};

const defaultLoadNotebookRenderer = async (): Promise<NotebookRendererModule> => {
  const { defaultLoadNotebookRenderer: loadRenderer } = await import(
    "./quickPreviewRenderers/notebookRenderer"
  );

  return loadRenderer();
};

const defaultLoadPptxRenderer = async (): Promise<PptxRendererModule> => {
  const { defaultLoadPptxRenderer: loadRenderer } = await import(
    "./quickPreviewRenderers/pptxRenderer"
  );

  return loadRenderer();
};

const defaultLoadHwpxRenderer = async (): Promise<HwpxRendererModule> => {
  const { defaultLoadHwpxRenderer: loadRenderer } = await import(
    "./quickPreviewRenderers/hwpxRenderer"
  );

  return loadRenderer();
};

const defaultLoadXlsxRenderer = async (): Promise<XlsxRendererModule> => {
  const { defaultLoadXlsxRenderer: loadRenderer } = await import(
    "./quickPreviewRenderers/xlsxRenderer"
  );

  return loadRenderer();
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
  const readFileContent = (filePath: string) =>
    options.invokeImpl
      ? options.invokeImpl<string>("read_file_content", { path: filePath })
      : useFileSystem().readFileContent(filePath);
  const convertFileSrcImpl = options.convertFileSrcImpl ?? convertFileSrc;
  const fetchImpl = options.fetchImpl ?? fetch;
  const loadTextHighlighter = options.loadTextHighlighter ?? defaultLoadTextHighlighter;
  const loadMarkdownRenderer = options.loadMarkdownRenderer ?? defaultLoadMarkdownRenderer;
  const loadNotebookRenderer = options.loadNotebookRenderer ?? defaultLoadNotebookRenderer;
  const loadPptxRenderer = options.loadPptxRenderer ?? defaultLoadPptxRenderer;
  const loadHwpxRenderer = options.loadHwpxRenderer ?? defaultLoadHwpxRenderer;
  const loadXlsxRenderer = options.loadXlsxRenderer ?? defaultLoadXlsxRenderer;
  const loadDocxRenderer = options.loadDocxRenderer ?? defaultLoadDocxRenderer;

  return loadPreviewFromHandlers(path, {
    extension,
    readFileContent,
    convertFileSrcImpl,
    fetchImpl,
    loadTextHighlighter,
    loadMarkdownRenderer,
    loadNotebookRenderer,
    loadPptxRenderer,
    loadHwpxRenderer,
    loadXlsxRenderer,
    loadDocxRenderer,
  });
};
