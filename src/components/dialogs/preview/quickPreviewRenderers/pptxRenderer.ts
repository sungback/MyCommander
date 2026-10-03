import {
  buildPreviewHtmlDocument,
  escapeHtml,
  getPreviewTheme,
  PptxRendererModule,
} from "./shared";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useFileSystem } from "../../../../hooks/useFileSystem";

const MAX_SLIDES = 100;

export interface PptxRendererOptions {
  readFileBinary?: (filePath: string) => Promise<ArrayBuffer | Uint8Array>;
  fetchImpl?: typeof fetch;
  convertFileSrcImpl?: (path: string) => string;
}

const readBuffer = async (
  filePath: string,
  options: PptxRendererOptions
): Promise<ArrayBuffer | Uint8Array> => {
  if (options.readFileBinary) {
    return options.readFileBinary(filePath);
  }

  try {
    return await useFileSystem().readFileBinary(filePath);
  } catch (error) {
    if (options.fetchImpl || options.convertFileSrcImpl) {
      const convert = options.convertFileSrcImpl ?? convertFileSrc;
      const fetchFn = options.fetchImpl ?? fetch;
      const url = convert(filePath);
      return await fetchFn(url).then((response) => response.arrayBuffer());
    }
    throw error;
  }
};

export const buildPptxHtml = async (
  filePath: string,
  options: PptxRendererOptions = {}
): Promise<string> => {
  const [{ default: JSZip }] = await Promise.all([import("jszip")]);
  const theme = getPreviewTheme();

  const buffer = await readBuffer(filePath, options);
  const zip = await JSZip.loadAsync(buffer);

  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const numB = Number.parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return numA - numB;
    });

  if (slideEntries.length === 0) {
    return `<html><body style="color:${theme.muted};font-family:sans-serif;padding:32px;background:${theme.background}">슬라이드를 찾을 수 없습니다.</body></html>`;
  }

  const totalSlides = slideEntries.length;
  const isTruncated = totalSlides > MAX_SLIDES;
  const displayEntries = isTruncated ? slideEntries.slice(0, MAX_SLIDES) : slideEntries;

  const slidesHtml = await Promise.all(
    displayEntries.map(async (name, index) => {
      const xmlStr = await zip.files[name].async("string");
      const parser = new DOMParser();
      const document = parser.parseFromString(xmlStr, "text/xml");
      const namespace = "http://schemas.openxmlformats.org/drawingml/2006/main";

      let nodes = Array.from(document.getElementsByTagNameNS(namespace, "t"));
      if (nodes.length === 0) {
        nodes = Array.from(document.getElementsByTagName("a:t"));
      }
      if (nodes.length === 0) {
        nodes = Array.from(document.getElementsByTagName("t"));
      }

      const texts: string[] = [];
      for (let i = 0; i < nodes.length; i += 1) {
        const text = nodes[i].textContent?.trim();
        if (text) {
          texts.push(text);
        }
      }

      const content =
        texts.length > 0
          ? texts.map((text) => `<div class="slide-line">${escapeHtml(text)}</div>`).join("")
          : `<div class="slide-empty">( 텍스트 없음 )</div>`;

      return `<div class="slide-card">
  <div class="slide-header">
    <span class="slide-badge">슬라이드 ${index + 1}</span>
  </div>
  <div class="slide-body">${content}</div>
</div>`;
    })
  );

  const truncateNote = isTruncated
    ? `<div class="truncate-note">처음 ${MAX_SLIDES}개 슬라이드만 표시됩니다 (전체 ${totalSlides}개)</div>\n`
    : "";

  return buildPreviewHtmlDocument({
    styles: `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.6; color: ${theme.foreground}; background: ${theme.background}; margin: 0; padding: 20px 24px; }
  .truncate-note { padding: 8px 14px; font-size: 12px; color: ${theme.muted}; background: ${theme.codeBackground}; border: 1px solid ${theme.border}; border-radius: 8px; margin-bottom: 14px; }
  .slide-card { background: ${theme.codeBackground}; border: 1px solid ${theme.border}; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
  .slide-header { padding: 8px 14px; border-bottom: 1px solid ${theme.border}; }
  .slide-badge { font-size: 11px; font-weight: 600; color: ${theme.badgeBlue}; background: ${theme.badgeBlueBackground}; padding: 2px 8px; border-radius: 10px; }
  .slide-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
  .slide-line { font-size: 13px; color: ${theme.foreground}; word-break: break-word; }
  .slide-empty { font-size: 12px; color: ${theme.muted}; font-style: italic; }
`,
    body: `${truncateNote}${slidesHtml.join("\n")}`,
  });
};

export const defaultLoadPptxRenderer = async (
  options: PptxRendererOptions = {}
): Promise<PptxRendererModule> => ({
  renderPptx: (filePath) => buildPptxHtml(filePath, options),
});
