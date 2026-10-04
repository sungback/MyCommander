import { convertFileSrc } from "@tauri-apps/api/core";
import { useFileSystem } from "../../../hooks/useFileSystem";
import {
  type MarkdownRendererModule,
  type NotebookRendererModule,
  type PptxRendererModule,
  type HwpxRendererModule,
  type SqliteRendererModule,
  type TextHighlighterModule,
  type XlsxRendererModule,
  type ZipRendererModule,
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

const defaultLoadDocxRenderer = async (
  readFileBinary?: (path: string, maxBytes?: number) => Promise<ArrayBuffer | Uint8Array>
): Promise<DocxRendererModule> => {
  const { renderDocx } = await import("./quickPreviewDocxRenderer");

  return {
    renderDocx: (filePath) => renderDocx(filePath, { readFileBinary }),
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

const defaultLoadPptxRenderer = async (
  readFileBinary?: (path: string, maxBytes?: number) => Promise<ArrayBuffer | Uint8Array>
): Promise<PptxRendererModule> => {
  const { defaultLoadPptxRenderer: loadRenderer } = await import(
    "./quickPreviewRenderers/pptxRenderer"
  );

  return loadRenderer({ readFileBinary });
};

const defaultLoadHwpxRenderer = async (
  readFileBinary?: (path: string, maxBytes?: number) => Promise<ArrayBuffer | Uint8Array>
): Promise<HwpxRendererModule> => {
  const { defaultLoadHwpxRenderer: loadRenderer } = await import(
    "./quickPreviewRenderers/hwpxRenderer"
  );

  return loadRenderer({ readFileBinary });
};

const defaultLoadXlsxRenderer = async (
  readFileBinary?: (path: string, maxBytes?: number) => Promise<ArrayBuffer | Uint8Array>
): Promise<XlsxRendererModule> => {
  const { defaultLoadXlsxRenderer: loadRenderer } = await import(
    "./quickPreviewRenderers/xlsxRenderer"
  );

  return loadRenderer({ readFileBinary });
};

const defaultLoadSqliteRenderer = async (): Promise<SqliteRendererModule> => {
  const { defaultLoadSqliteRenderer: loadRenderer } = await import(
    "./quickPreviewRenderers/sqliteRenderer"
  );

  return loadRenderer();
};

const defaultLoadZipRenderer = async (
  previewZipArchive?: (filePath: string) => Promise<import("../../../types/zipPreview").ZipArchivePreview>
): Promise<ZipRendererModule> => {
  const { defaultLoadZipRenderer: loadRenderer } = await import(
    "./quickPreviewRenderers/zipRenderer"
  );

  return loadRenderer({ previewZipArchive });
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
  const readFileContent = (filePath: string, maxBytes?: number) =>
    options.invokeImpl
      ? options.invokeImpl<string>("read_file_content", {
          path: filePath,
          ...(maxBytes != null ? { max_bytes: maxBytes } : {}),
        })
      : (options.readFileContent ?? useFileSystem().readFileContent)(filePath, maxBytes);
  const readFileBinary = (filePath: string, maxBytes?: number) =>
    options.invokeImpl
      ? options.invokeImpl<ArrayBuffer>("read_file_binary", {
          path: filePath,
          ...(maxBytes != null ? { max_bytes: maxBytes } : {}),
        })
      : (options.readFileBinary ?? useFileSystem().readFileBinary)(filePath, maxBytes);
  const previewZipArchive = (filePath: string) =>
    options.invokeImpl
      ? options.invokeImpl<import("../../../types/zipPreview").ZipArchivePreview>("preview_zip_archive", {
          path: filePath,
        })
      : useFileSystem().previewZipArchive(filePath);
  const convertFileSrcImpl = options.convertFileSrcImpl ?? convertFileSrc;
  const loadTextHighlighter = options.loadTextHighlighter ?? defaultLoadTextHighlighter;
  const loadMarkdownRenderer = options.loadMarkdownRenderer ?? defaultLoadMarkdownRenderer;
  const loadNotebookRenderer = options.loadNotebookRenderer ?? defaultLoadNotebookRenderer;
  const loadPptxRenderer =
    options.loadPptxRenderer ?? (() => defaultLoadPptxRenderer(readFileBinary));
  const loadHwpxRenderer =
    options.loadHwpxRenderer ?? (() => defaultLoadHwpxRenderer(readFileBinary));
  const loadXlsxRenderer =
    options.loadXlsxRenderer ?? (() => defaultLoadXlsxRenderer(readFileBinary));
  const loadSqliteRenderer = options.loadSqliteRenderer ?? defaultLoadSqliteRenderer;
  const loadDocxRenderer =
    options.loadDocxRenderer ?? (() => defaultLoadDocxRenderer(readFileBinary));
  const loadZipRenderer =
    options.loadZipRenderer ?? (() => defaultLoadZipRenderer(previewZipArchive));

  return loadPreviewFromHandlers(path, {
    extension,
    readFileContent,
    readFileBinary,
    convertFileSrcImpl,
    loadTextHighlighter,
    loadMarkdownRenderer,
    loadNotebookRenderer,
    loadPptxRenderer,
    loadHwpxRenderer,
    loadXlsxRenderer,
    loadSqliteRenderer,
    loadDocxRenderer,
    loadZipRenderer,
  });
};
