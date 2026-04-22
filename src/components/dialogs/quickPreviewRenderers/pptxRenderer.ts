import { escapeHtml, getAppTheme, PptxRendererModule } from "./shared";
import { convertFileSrc } from "@tauri-apps/api/core";

const buildPptxHtml = async (filePath: string): Promise<string> => {
  const [{ default: JSZip }] = await Promise.all([import("jszip")]);

  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const cardBg = isDark ? "#161b22" : "#f6f8fa";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const badgeColor = isDark ? "#58a6ff" : "#0969da";
  const badgeBg = isDark ? "rgba(88,166,255,0.12)" : "rgba(9,105,218,0.1)";
  const emptyColor = isDark ? "#6e7681" : "#9ca3af";

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
    return `<html><body style="color:${emptyColor};font-family:sans-serif;padding:32px;background:${bg}">슬라이드를 찾을 수 없습니다.</body></html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.6; color: ${fg}; background: ${bg}; margin: 0; padding: 20px 24px; }
  .slide-card { background: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
  .slide-header { padding: 8px 14px; border-bottom: 1px solid ${borderColor}; }
  .slide-badge { font-size: 11px; font-weight: 600; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 8px; border-radius: 10px; }
  .slide-body { padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
  .slide-line { font-size: 13px; color: ${fg}; word-break: break-word; }
  .slide-empty { font-size: 12px; color: ${emptyColor}; font-style: italic; }
</style>
</head>
<body>${slidesHtml.join("\n")}</body>
</html>`;
};

export const defaultLoadPptxRenderer = async (): Promise<PptxRendererModule> => ({
  renderPptx: (filePath) => buildPptxHtml(filePath),
});
