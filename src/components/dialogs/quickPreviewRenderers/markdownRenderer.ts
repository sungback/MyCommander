import { getAppTheme, MARKDOWN_LINK_COLOR, MarkdownRendererModule } from "./shared";

const buildMarkdownHtml = (body: string): string => {
  const isDark = getAppTheme() === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  const fg = isDark ? "#e6edf3" : "#1f2328";
  const borderColor = isDark ? "#30363d" : "#d1d9e0";
  const codeBg = isDark ? "#161b22" : "#f6f8fa";
  const blockquoteColor = isDark ? "#8b949e" : "#636c76";
  const linkColor = isDark ? MARKDOWN_LINK_COLOR.dark : MARKDOWN_LINK_COLOR.light;
  const trEvenBg = isDark ? "#161b22" : "#f6f8fa";
  const thBg = isDark ? "#161b22" : "#f6f8fa";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.7; padding: 24px 32px;
    color: ${fg}; background: ${bg}; margin: 0;
  }
  h1,h2,h3,h4,h5,h6 { font-weight: 600; margin: 1.2em 0 0.5em; color: ${fg}; }
  h1 { font-size: 2em; border-bottom: 1px solid ${borderColor}; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid ${borderColor}; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  p { margin: 0.8em 0; }
  a { color: ${linkColor}; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code {
    background: ${codeBg}; padding: 0.2em 0.4em;
    border-radius: 4px; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 85%;
  }
  pre {
    background: ${codeBg}; padding: 16px; border-radius: 6px;
    overflow-x: auto; margin: 1em 0;
  }
  pre code { background: none; padding: 0; font-size: 100%; }
  blockquote {
    border-left: 4px solid ${borderColor}; padding: 0 1em;
    color: ${blockquoteColor}; margin: 0 0 1em;
  }
  ul, ol { padding-left: 2em; margin: 0.5em 0; }
  li { margin: 0.25em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid ${borderColor}; padding: 6px 13px; text-align: left; }
  th { background: ${thBg}; font-weight: 600; }
  tr:nth-child(even) td { background: ${trEvenBg}; }
  img { max-width: 100%; border-radius: 4px; }
  hr { border: none; border-top: 1px solid ${borderColor}; margin: 1.5em 0; }
  strong { font-weight: 600; }
  del { color: ${blockquoteColor}; }
  input[type="checkbox"] { margin-right: 0.4em; }
</style>
</head>
<body>${body}</body>
</html>`;
};

export const defaultLoadMarkdownRenderer = async (): Promise<MarkdownRendererModule> => ({
  renderMarkdown: async (content) => {
    const { marked } = await import("marked");
    const htmlBody = await marked.parse(content);
    return buildMarkdownHtml(htmlBody);
  },
});
