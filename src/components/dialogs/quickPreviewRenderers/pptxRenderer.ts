import {
  buildPreviewHtmlDocument,
  escapeHtml,
  getPreviewTheme,
  PptxRendererModule,
} from "./shared";
import { convertFileSrc } from "@tauri-apps/api/core";

const buildPptxHtml = async (filePath: string): Promise<string> => {
  const [{ default: JSZip }] = await Promise.all([import("jszip")]);
  const theme = getPreviewTheme();

  const url = convertFileSrc(filePath);
  const buffer = await fetch(url).then((response) => response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);

  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const numB = Number.parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return numA - numB;
    });

  const slidesHtml = await Promise.all(
    slideEntries.map(async (name, index) => {
      const xmlStr = await zip.files[name].async("string");
      const parser = new DOMParser();
      const document = parser.parseFromString(xmlStr, "text/xml");
      const namespace = "http://schemas.openxmlformats.org/drawingml/2006/main";
      const nodes = document.getElementsByTagNameNS(namespace, "t");
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

  if (slidesHtml.length === 0) {
    return `<html><body style="color:${theme.muted};font-family:sans-serif;padding:32px;background:${theme.background}">슬라이드를 찾을 수 없습니다.</body></html>`;
  }

  return buildPreviewHtmlDocument({
    styles: `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.6; color: ${theme.foreground}; background: ${theme.background}; margin: 0; padding: 20px 24px; }
  .slide-card { background: ${theme.codeBackground}; border: 1px solid ${theme.border}; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
  .slide-header { padding: 8px 14px; border-bottom: 1px solid ${theme.border}; }
  .slide-badge { font-size: 11px; font-weight: 600; color: ${theme.badgeBlue}; background: ${theme.badgeBlueBackground}; padding: 2px 8px; border-radius: 10px; }
  .slide-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
  .slide-line { font-size: 13px; color: ${theme.foreground}; word-break: break-word; }
  .slide-empty { font-size: 12px; color: ${theme.muted}; font-style: italic; }
`,
    body: slidesHtml.join("\n"),
  });
};

export const defaultLoadPptxRenderer = async (): Promise<PptxRendererModule> => ({
  renderPptx: (filePath) => buildPptxHtml(filePath),
});
