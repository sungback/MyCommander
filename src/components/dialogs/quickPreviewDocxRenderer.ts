import { convertFileSrc } from "@tauri-apps/api/core";

const DOCX_BODY_EMPTY_MESSAGE = "표시할 텍스트를 찾을 수 없습니다.";

const getAppTheme = (): "dark" | "light" =>
  (document.documentElement.dataset.theme as "dark" | "light") ?? "dark";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const getLocalName = (node: Node) =>
  node.nodeType === Node.ELEMENT_NODE ? (node as Element).localName : "";

const renderInlineNode = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return text.trim() ? escapeHtml(text) : "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as Element;
  switch (element.localName) {
    case "t":
      return escapeHtml(element.textContent ?? "");
    case "tab":
      return "&emsp;";
    case "br":
    case "cr":
      return "<br/>";
    default:
      return Array.from(element.childNodes).map(renderInlineNode).join("");
  }
};

const renderParagraphElement = (paragraph: Element) => {
  const content = Array.from(paragraph.childNodes).map(renderInlineNode).join("").trim();
  if (!content) {
    return "";
  }

  return `<p class="docx-paragraph">${content}</p>`;
};

const renderTableCell = (cell: Element) => {
  const paragraphs = Array.from(cell.children)
    .filter((child) => getLocalName(child) === "p")
    .map((paragraph) => renderParagraphElement(paragraph))
    .filter(Boolean);

  const content = paragraphs.length > 0
    ? paragraphs.join("")
    : `<p class="docx-cell-empty">${DOCX_BODY_EMPTY_MESSAGE}</p>`;

  return `<td>${content}</td>`;
};

const renderTableElement = (table: Element) => {
  const rows = Array.from(table.children)
    .filter((child) => getLocalName(child) === "tr")
    .map((row) => {
      const cells = Array.from(row.children)
        .filter((child) => getLocalName(child) === "tc")
        .map((cell) => renderTableCell(cell))
        .join("");

      return cells ? `<tr>${cells}</tr>` : "";
    })
    .filter(Boolean)
    .join("");

  if (!rows) {
    return "";
  }

  return `<div class="docx-table-wrap"><table class="docx-table"><tbody>${rows}</tbody></table></div>`;
};

export const renderDocxDocumentXml = (xmlContent: string): string => {
  const parser = new DOMParser();
  const document = parser.parseFromString(xmlContent, "application/xml");
  const body = document.getElementsByTagNameNS(
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "body"
  )[0] ?? Array.from(document.getElementsByTagName("*")).find((node) => node.localName === "body");

  if (!body) {
    return `<p class="docx-empty">${DOCX_BODY_EMPTY_MESSAGE}</p>`;
  }

  const blocks = Array.from(body.children)
    .map((child) => {
      switch (child.localName) {
        case "p":
          return renderParagraphElement(child);
        case "tbl":
          return renderTableElement(child);
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("");

  return blocks || `<p class="docx-empty">${DOCX_BODY_EMPTY_MESSAGE}</p>`;
};

export const renderDocx = async (
  filePath: string,
  options: {
    convertFileSrcImpl?: (path: string) => string;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<string> => {
  const [{ default: JSZip }] = await Promise.all([
    import("jszip"),
  ]);

  const convertFileSrcImpl = options.convertFileSrcImpl ?? convertFileSrc;
  const fetchImpl = options.fetchImpl ?? fetch;

  const url = convertFileSrcImpl(filePath);
  const buffer = await fetchImpl(url).then((response) => response.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  const documentEntry = zip.file("word/document.xml");

  if (!documentEntry) {
    throw new Error("DOCX document.xml을 찾을 수 없습니다.");
  }

  const xmlContent = await documentEntry.async("string");
  const bodyHtml = renderDocxDocumentXml(xmlContent);

  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const tableHeaderBg = isDark ? "#161b22" : "#f6f8fa";
  const emptyColor = isDark ? "#6e7681" : "#9ca3af";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: ${fg};
    background: ${bg};
    margin: 0;
    padding: 24px 28px;
  }
  .docx-paragraph {
    margin: 0 0 0.9em;
    word-break: break-word;
    white-space: normal;
  }
  .docx-empty,
  .docx-cell-empty {
    color: ${emptyColor};
    font-style: italic;
  }
  .docx-table-wrap {
    overflow-x: auto;
    margin: 1.2em 0;
  }
  .docx-table {
    width: 100%;
    border-collapse: collapse;
    min-width: max-content;
  }
  .docx-table td {
    border: 1px solid ${borderColor};
    padding: 8px 10px;
    vertical-align: top;
    background: ${tableHeaderBg};
  }
  .docx-table .docx-paragraph:last-child {
    margin-bottom: 0;
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
};
