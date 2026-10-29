// pdf.js가 작업자 스레드에서 디렉터리 URL로 받아 오는 리소스를 같은 출처의 `/pdfjs/` 아래에서 제공한다.
// - cmaps: 글꼴이 내장되지 않은 한·중·일 PDF의 문자 매핑
// - standard_fonts: 내장되지 않은 표준 14 글꼴
// - wasm/*_nowasm_fallback.js: WebAssembly를 쓰지 않을 때의 이미지 해독 모듈(JPEG 2000, JBIG2)
// 개발 서버에서는 node_modules의 파일로 응답하고, 빌드에서는 해시 없는 같은 경로로 내보낸다.
import { createReadStream, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PDFJS_ROOT = fileURLToPath(new URL("../node_modules/pdfjs-dist/", import.meta.url));
const URL_PREFIX = "/pdfjs/";
const RESOURCE_DIRECTORIES = [
  { name: "cmaps", include: () => true },
  { name: "standard_fonts", include: () => true },
  { name: "wasm", include: (file) => file.endsWith("_nowasm_fallback.js") },
];
const CONTENT_TYPES = {
  ".js": "text/javascript",
  ".ttf": "font/ttf",
};

const listResources = () =>
  new Map(
    RESOURCE_DIRECTORIES.flatMap(({ name, include }) =>
      readdirSync(path.join(PDFJS_ROOT, name))
        .filter(include)
        .map((file) => [`${name}/${file}`, path.join(PDFJS_ROOT, name, file)])
    )
  );

/** @returns {import("vite").Plugin} */
export const pdfjsResourcesPlugin = () => {
  let resources = null;
  const getResources = () => {
    resources ??= listResources();
    return resources;
  };

  return {
    name: "mycommander-pdfjs-resources",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = (request.url ?? "").split("?")[0];
        if (!url.startsWith(URL_PREFIX)) {
          next();
          return;
        }

        const filePath = getResources().get(decodeURIComponent(url.slice(URL_PREFIX.length)));
        if (!filePath) {
          next();
          return;
        }

        response.setHeader(
          "Content-Type",
          CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream"
        );
        createReadStream(filePath).pipe(response);
      });
    },
    generateBundle() {
      for (const [urlPath, filePath] of getResources()) {
        this.emitFile({
          type: "asset",
          fileName: `pdfjs/${urlPath}`,
          source: readFileSync(filePath),
        });
      }
    },
  };
};
