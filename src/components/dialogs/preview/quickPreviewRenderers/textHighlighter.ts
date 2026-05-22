import {
  EXT_TO_LANG,
  TextHighlightResult,
  TextHighlighterModule,
} from "./shared";

let textHighlighterPromise: Promise<TextHighlighterModule> | null = null;

const createTextHighlighterModule = async (): Promise<TextHighlighterModule> => {
  const [
    { default: hljs },
    { default: langTypescript },
    { default: langJavascript },
    { default: langPython },
    { default: langR },
    { default: langRust },
    { default: langGo },
    { default: langJava },
    { default: langC },
    { default: langCpp },
    { default: langBash },
    { default: langCss },
    { default: langXml },
    { default: langJson },
    { default: langYaml },
    { default: langSql },
    { default: langMarkdown },
    { default: langIni },
    { default: langGraphql },
  ] = await Promise.all([
    import("highlight.js/lib/core"),
    import("highlight.js/lib/languages/typescript"),
    import("highlight.js/lib/languages/javascript"),
    import("highlight.js/lib/languages/python"),
    import("highlight.js/lib/languages/r"),
    import("highlight.js/lib/languages/rust"),
    import("highlight.js/lib/languages/go"),
    import("highlight.js/lib/languages/java"),
    import("highlight.js/lib/languages/c"),
    import("highlight.js/lib/languages/cpp"),
    import("highlight.js/lib/languages/bash"),
    import("highlight.js/lib/languages/css"),
    import("highlight.js/lib/languages/xml"),
    import("highlight.js/lib/languages/json"),
    import("highlight.js/lib/languages/yaml"),
    import("highlight.js/lib/languages/sql"),
    import("highlight.js/lib/languages/markdown"),
    import("highlight.js/lib/languages/ini"),
    import("highlight.js/lib/languages/graphql"),
    import("highlight.js/styles/atom-one-dark.css"),
  ]);

  hljs.registerLanguage("typescript", langTypescript);
  hljs.registerLanguage("javascript", langJavascript);
  hljs.registerLanguage("python", langPython);
  hljs.registerLanguage("r", langR);
  hljs.registerLanguage("rust", langRust);
  hljs.registerLanguage("go", langGo);
  hljs.registerLanguage("java", langJava);
  hljs.registerLanguage("c", langC);
  hljs.registerLanguage("cpp", langCpp);
  hljs.registerLanguage("bash", langBash);
  hljs.registerLanguage("css", langCss);
  hljs.registerLanguage("xml", langXml);
  hljs.registerLanguage("json", langJson);
  hljs.registerLanguage("yaml", langYaml);
  hljs.registerLanguage("sql", langSql);
  hljs.registerLanguage("markdown", langMarkdown);
  hljs.registerLanguage("ini", langIni);
  hljs.registerLanguage("graphql", langGraphql);

  const languageHints = Array.from(new Set(Object.values(EXT_TO_LANG)));

  const highlightSnippet = async (
    content: string,
    language?: string
  ): Promise<TextHighlightResult | null> => {
    try {
      const result = language
        ? hljs.highlight(content, { language, ignoreIllegals: true })
        : hljs.highlightAuto(content, languageHints);
      return {
        highlightedHtml: result.value,
        language: result.language ?? language,
      };
    } catch {
      return null;
    }
  };

  return {
    highlightSnippet,
    highlightText: (content, extension) => highlightSnippet(content, EXT_TO_LANG[extension]),
    highlightSource: async (content, renderExt) => {
      const sourceLanguage = renderExt === "markdown" ? "markdown" : "xml";
      const highlighted = await highlightSnippet(content, sourceLanguage);
      return highlighted?.highlightedHtml ?? null;
    },
  };
};

export const defaultLoadTextHighlighter = () => {
  if (!textHighlighterPromise) {
    textHighlighterPromise = createTextHighlighterModule();
  }

  return textHighlighterPromise;
};
