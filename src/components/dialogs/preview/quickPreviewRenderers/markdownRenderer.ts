import {
  buildPreviewHtmlDocument,
  getPreviewTheme,
  MarkdownRendererModule,
} from "./shared";

const buildMarkdownHtml = (body: string): string => {
  const theme = getPreviewTheme();

  return buildPreviewHtmlDocument({
    styles: `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    font-size: 14px; line-height: 1.7; padding: 24px 32px;
    color: ${theme.foreground}; background: ${theme.background}; margin: 0;
  }
  h1,h2,h3,h4,h5,h6 { font-weight: 600; margin: 1.2em 0 0.5em; color: ${theme.foreground}; }
  h1 { font-size: 2em; border-bottom: 1px solid ${theme.border}; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid ${theme.border}; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  p { margin: 0.8em 0; }
  a { color: ${theme.link}; text-decoration: none; }
  a:hover { text-decoration: underline; }
  code {
    background: ${theme.codeBackground}; padding: 0.2em 0.4em;
    border-radius: 4px; font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 85%;
  }
  pre {
    background: ${theme.codeBackground}; padding: 16px; border-radius: 6px;
    overflow-x: auto; margin: 1em 0;
  }
  pre code { background: none; padding: 0; font-size: 100%; }
  blockquote {
    border-left: 4px solid ${theme.border}; padding: 0 1em;
    color: ${theme.blockquote}; margin: 0 0 1em;
  }
  ul, ol { padding-left: 2em; margin: 0.5em 0; }
  li { margin: 0.25em 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid ${theme.border}; padding: 6px 13px; text-align: left; }
  th { background: ${theme.codeBackground}; font-weight: 600; }
  tr:nth-child(even) td { background: ${theme.codeBackground}; }
  img { max-width: 100%; border-radius: 4px; }
  hr { border: none; border-top: 1px solid ${theme.border}; margin: 1.5em 0; }
  strong { font-weight: 600; }
  del { color: ${theme.blockquote}; }
  input[type="checkbox"] { margin-right: 0.4em; }
`,
    body,
  });
};

export const defaultLoadMarkdownRenderer = async (): Promise<MarkdownRendererModule> => ({
  renderMarkdown: async (content) => {
    const { marked } = await import("marked");
    const htmlBody = await marked.parse(content);
    return buildMarkdownHtml(htmlBody);
  },
});
