import { escapeHtml, getAppTheme, HwpxRendererModule } from "./shared";
import { convertFileSrc } from "@tauri-apps/api/core";

const buildHwpxHtml = async (filePath: string): Promise<string> => {
  const [{ default: JSZip }] = await Promise.all([import("jszip")]);

  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const cardBg = isDark ? "#161b22" : "#f6f8fa";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const badgeColor = isDark ? "#58a6ff" : "#0969da";
  const badgeBg = isDark ? "rgba(88,166,255,0.12)" : "rgba(9,105,218,0.1)";
  const emptyColor = isDark ? "#6e7681" : "#9ca3af";
  const dividerColor = isDark ? "#21262d" : "#e1e4e8";

  const url = convertFileSrc(filePath);
  const buffer = await fetch(url).then((response) => response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);

  const sectionEntries = Object.keys(zip.files)
    .filter((name) => /^[Cc]ontents\/[Ss]ection\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number.parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const numB = Number.parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return numA - numB;
    });

  if (sectionEntries.length === 0) {
    return `<html><body style="color:${emptyColor};font-family:sans-serif;padding:32px;background:${bg}">섹션 파일을 찾을 수 없습니다.</body></html>`;
  }

  const sectionsHtml = await Promise.all(
    sectionEntries.map(async (name, index) => {
      const xmlStr = await zip.files[name].async("string");
      const parser = new DOMParser();
      const document = parser.parseFromString(xmlStr, "text/xml");
      const paragraphs: string[] = [];
      const paragraphNodes = document.getElementsByTagName("hp:p");

      if (paragraphNodes.length > 0) {
        for (let i = 0; i < paragraphNodes.length; i += 1) {
          const textNodes = paragraphNodes[i].getElementsByTagName("hp:t");
          const line = Array.from(textNodes)
            .map((node) => node.textContent ?? "")
            .join("");

          if (line.trim()) {
            paragraphs.push(line.trim());
          }
        }
      } else {
        const textNodes = document.getElementsByTagName("hp:t");
        for (let i = 0; i < textNodes.length; i += 1) {
          const text = textNodes[i].textContent?.trim();
          if (text) {
            paragraphs.push(text);
          }
        }
      }

      const content =
        paragraphs.length > 0
          ? paragraphs
              .map((paragraph) => `<p class="hwp-para">${escapeHtml(paragraph)}</p>`)
              .join("")
          : `<p class="hwp-empty">( 텍스트 없음 )</p>`;

      return `<div class="section-card">
  <div class="section-header">
    <span class="section-badge">섹션 ${index + 1}</span>
  </div>
  <div class="section-body">${content}</div>
</div>`;
    })
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    font-size: 14px; line-height: 1.7; color: ${fg}; background: ${bg}; margin: 0; padding: 20px 24px; }
  .section-card { background: ${cardBg}; border: 1px solid ${borderColor}; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
  .section-header { padding: 8px 14px; border-bottom: 1px solid ${dividerColor}; }
  .section-badge { font-size: 11px; font-weight: 600; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 8px; border-radius: 10px; }
  .section-body { padding: 12px 16px; }
  .hwp-para { margin: 0 0 6px; font-size: 13px; color: ${fg}; word-break: break-word; }
  .hwp-para:last-child { margin-bottom: 0; }
  .hwp-empty { font-size: 12px; color: ${emptyColor}; font-style: italic; margin: 0; }
</style>
</head>
<body>${sectionsHtml.join("\n")}</body>
</html>`;
};

export const defaultLoadHwpxRenderer = async (): Promise<HwpxRendererModule> => ({
  renderHwpx: (filePath) => buildHwpxHtml(filePath),
});
