import type {
  Element,
  Fill,
  GradientFill,
  Group,
  Image,
  LineEnd,
  Shape,
  Slide,
  Table,
  TableCell,
  Text,
} from "pptxtojson";

/** 슬라이드 크기(pt). */
export interface SlideSize {
  width: number;
  height: number;
}

/**
 * 설치되지 않은 글꼴이어도 한글이 깨지지 않도록 덧붙이는 대체 글꼴.
 * pptxtojson은 style 속성을 큰따옴표로 감싸므로 작은따옴표만 쓴다(큰따옴표는 속성을 중간에서 끝낸다).
 */
const FONT_FALLBACK = `'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`;
const GENERIC_FONT_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);
const MEDIA_LABEL = "미디어";

const escapeAttribute = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const pt = (value: number) => `${Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}pt`;

/**
 * 글꼴 이름을 작은따옴표로 감싼다. "더잠실 2 Light"처럼 숫자로 시작하는 단어가 있는 이름은
 * 따옴표가 없으면 CSS 문법 오류가 되어 선언 전체가 무시된다.
 */
const quoteFontFamily = (family: string) => {
  const name = family.trim();
  if (!name || /^['"]/.test(name) || GENERIC_FONT_FAMILIES.has(name.toLowerCase())) {
    return name;
  }
  return `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
};

/** pptxtojson 텍스트 HTML의 글꼴 지정을 따옴표로 감싸고 뒤에 대체 글꼴을 붙인다. */
export const withFontFallback = (html: string) =>
  html.replace(/font-family:\s*([^;"]+?)\s*(?=;|")/g, (_match, families: string) => {
    const quoted = families.split(",").map(quoteFontFamily).filter(Boolean).join(", ");
    return `font-family: ${quoted ? `${quoted}, ` : ""}${FONT_FALLBACK}`;
  });

const isBlobUrl = (value: unknown): value is string =>
  typeof value === "string" && value.startsWith("blob:");

/** 웹뷰가 표시하지 못하는 이미지 형식(Windows 메타파일, JPEG XR)이면 확장자를 돌려준다. */
const getUnsupportedImageFormat = (ref: string | undefined) =>
  ref?.match(/\.(emf|wmf|wdp)$/i)?.[1].toUpperCase() ?? null;

const V_ALIGN: Record<string, string> = { up: "flex-start", mid: "center", down: "flex-end" };
const CELL_V_ALIGN: Record<string, string> = { up: "top", mid: "middle", down: "bottom" };

const gradientCss = (fill: GradientFill) => {
  const stops = fill.value.colors.map((stop) => `${stop.color} ${stop.pos}`).join(", ");
  return fill.value.path === "line"
    ? `linear-gradient(${90 + fill.value.rot}deg, ${stops})`
    : `radial-gradient(circle, ${stops})`;
};

/** CSS 배경으로 표현한 채우기. 무늬 채우기는 배경색으로 근사한다. */
const fillCss = (fill: Fill | null | undefined) => {
  if (!fill) {
    return "";
  }
  switch (fill.type) {
    case "color":
      return `background-color:${escapeAttribute(fill.value)};`;
    case "gradient":
      return `background-image:${escapeAttribute(gradientCss(fill))};`;
    case "image":
      return isBlobUrl(fill.value.blob) && !getUnsupportedImageFormat(fill.value.ref)
        ? `background-image:url("${escapeAttribute(fill.value.blob)}");background-size:100% 100%;`
        : "";
    case "pattern":
      return `background-color:${escapeAttribute(fill.value.backgroundColor)};`;
    default:
      return "";
  }
};

const borderCss = (element: { borderColor: string; borderWidth: number; borderType: string }) =>
  element.borderWidth > 0 && element.borderColor
    ? `border:${pt(element.borderWidth)} ${escapeAttribute(element.borderType || "solid")} ${escapeAttribute(element.borderColor)};`
    : "";

const flipTransform = (element: { isFlipH?: boolean; isFlipV?: boolean }) =>
  `${element.isFlipH ? " scaleX(-1)" : ""}${element.isFlipV ? " scaleY(-1)" : ""}`;

const boxStyle = (element: {
  left: number;
  top: number;
  width: number;
  height: number;
  rotate?: number;
}) =>
  `left:${pt(element.left)};top:${pt(element.top)};width:${pt(element.width)};height:${pt(element.height)};` +
  (element.rotate ? `transform:rotate(${element.rotate}deg);` : "");

const byOrder = (elements: Element[]) =>
  [...elements].sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

/** 도형·텍스트 상자 안의 서식 있는 텍스트 층. */
const textLayer = (element: Shape | Text) => {
  if (!element.content) {
    return "";
  }

  const inset = element.textInset;
  const padding = inset
    ? `padding:${pt(inset.t)} ${pt(inset.r)} ${pt(inset.b)} ${pt(inset.l)};`
    : "padding:3.6pt 7.2pt;";
  const scale =
    element.autoFit?.type === "text" && element.autoFit.fontScale
      ? `zoom:${element.autoFit.fontScale / 100};`
      : "";
  const vertical = "isVertical" in element && element.isVertical ? "writing-mode:vertical-rl;" : "";
  const wrap = element.wrap === false ? "white-space:nowrap;" : "";

  return `<div class="text-layer" style="${padding}justify-content:${V_ALIGN[element.vAlign] ?? "flex-start"};${vertical}${wrap}"><div style="${scale}">${withFontFallback(element.content)}</div></div>`;
};

let svgIdCounter = 0;

const markerDefinition = (id: string, end: LineEnd | undefined, color: string) =>
  end && end.type !== "none"
    ? `<marker id="${id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${escapeAttribute(color)}"/></marker>`
    : "";

const renderShape = (shape: Shape) => {
  const id = `s${(svgIdCounter += 1)}`;
  const strokeColor = shape.borderColor || "none";
  const hasStroke = shape.borderWidth > 0 && Boolean(shape.borderColor);
  const definitions: string[] = [];
  let fill = "none";

  if (!shape.strokeOnly && shape.fill) {
    if (shape.fill.type === "color") {
      fill = escapeAttribute(shape.fill.value);
    } else if (shape.fill.type === "gradient") {
      const stops = shape.fill.value.colors
        .map((stop) => `<stop offset="${escapeAttribute(stop.pos)}" stop-color="${escapeAttribute(stop.color)}"/>`)
        .join("");
      definitions.push(
        shape.fill.value.path === "line"
          ? `<linearGradient id="${id}-fill" gradientTransform="rotate(${shape.fill.value.rot} 0.5 0.5)">${stops}</linearGradient>`
          : `<radialGradient id="${id}-fill">${stops}</radialGradient>`
      );
      fill = `url(#${id}-fill)`;
    } else if (
      shape.fill.type === "image" &&
      isBlobUrl(shape.fill.value.blob) &&
      !getUnsupportedImageFormat(shape.fill.value.ref)
    ) {
      definitions.push(
        `<pattern id="${id}-fill" patternContentUnits="objectBoundingBox" width="1" height="1"><image href="${escapeAttribute(shape.fill.value.blob)}" width="1" height="1" preserveAspectRatio="none"/></pattern>`
      );
      fill = `url(#${id}-fill)`;
    } else if (shape.fill.type === "pattern") {
      fill = escapeAttribute(shape.fill.value.backgroundColor);
    }
  }

  const startMarker = markerDefinition(`${id}-head`, shape.headEnd, strokeColor);
  const endMarker = markerDefinition(`${id}-tail`, shape.tailEnd, strokeColor);
  definitions.push(startMarker, endMarker);
  const viewBox = shape.pathViewBox
    ? `${shape.pathViewBox.x} ${shape.pathViewBox.y} ${shape.pathViewBox.width} ${shape.pathViewBox.height}`
    : `0 0 ${shape.width} ${shape.height}`;
  const path = shape.path ?? `M0,0 L${shape.width},0 L${shape.width},${shape.height} L0,${shape.height} Z`;
  const stroke = hasStroke
    ? ` stroke="${escapeAttribute(strokeColor)}" stroke-width="${shape.borderWidth}"${
        shape.borderStrokeDasharray && shape.borderStrokeDasharray !== "0"
          ? ` stroke-dasharray="${escapeAttribute(shape.borderStrokeDasharray)}"`
          : ""
      }`
    : "";
  const markers = `${startMarker ? ` marker-start="url(#${id}-head)"` : ""}${endMarker ? ` marker-end="url(#${id}-tail)"` : ""}`;
  const flip = flipTransform(shape).trim();

  return `<div class="el" style="${boxStyle(shape)}"><svg class="shape-svg" viewBox="${viewBox}" preserveAspectRatio="none"${flip ? ` style="transform:${flip}"` : ""}><defs>${definitions.join("")}</defs><path d="${escapeAttribute(path)}" fill="${fill}"${stroke}${markers}/></svg>${textLayer(shape)}</div>`;
};

const renderText = (text: Text) =>
  `<div class="el" style="${boxStyle(text)}${fillCss(text.fill)}${borderCss(text)}">${textLayer(text)}</div>`;

/** 자르기 영역(퍼센트)을 반영해 이미지를 상자 안에 배치한다. */
const renderImage = (image: Image) => {
  const unsupportedFormat = getUnsupportedImageFormat(image.ref);
  if (unsupportedFormat) {
    return placeholder(image, `이미지 (${unsupportedFormat})`);
  }
  if (!isBlobUrl(image.blob)) {
    return placeholder(image, "이미지");
  }

  const crop = { l: image.rect?.l ?? 0, r: image.rect?.r ?? 0, t: image.rect?.t ?? 0, b: image.rect?.b ?? 0 };
  const visibleWidth = Math.max(100 - crop.l - crop.r, 1);
  const visibleHeight = Math.max(100 - crop.t - crop.b, 1);
  const imageStyle =
    `width:${(100 / visibleWidth) * 100}%;height:${(100 / visibleHeight) * 100}%;` +
    `left:${(-crop.l / visibleWidth) * 100}%;top:${(-crop.t / visibleHeight) * 100}%;`;
  const radius =
    image.geom === "ellipse" ? "border-radius:50%;" : image.geom === "roundRect" ? "border-radius:8%;" : "";
  const flip = flipTransform(image).trim();

  return `<div class="el image" style="${boxStyle(image)}${borderCss(image)}${radius}"><img src="${escapeAttribute(image.blob)}" alt="" style="${imageStyle}${flip ? `transform:${flip};` : ""}"/></div>`;
};

const cellBorder = (side: string, border: TableCell["borders"]["top"]) =>
  border && border.borderWidth > 0
    ? `border-${side}:${pt(border.borderWidth)} ${escapeAttribute(border.borderType || "solid")} ${escapeAttribute(border.borderColor)};`
    : "";

const renderTable = (table: Table) => {
  const columns = table.colWidths.map((width) => `<col style="width:${pt(width)}"/>`).join("");
  const rows = table.data
    .map((row, rowIndex) => {
      const cells = row
        // 병합으로 가려진 셀은 그리지 않는다.
        .filter((cell) => !cell.hMerge && !cell.vMerge)
        .map((cell) => {
          const span = `${cell.rowSpan && cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ""}${
            cell.colSpan && cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : ""
          }`;
          const style =
            (cell.fillColor ? `background-color:${escapeAttribute(cell.fillColor)};` : "") +
            (cell.fontColor ? `color:${escapeAttribute(cell.fontColor)};` : "") +
            (cell.fontBold ? "font-weight:bold;" : "") +
            `vertical-align:${CELL_V_ALIGN[cell.vAlign] ?? "top"};` +
            cellBorder("top", cell.borders?.top) +
            cellBorder("bottom", cell.borders?.bottom) +
            cellBorder("left", cell.borders?.left) +
            cellBorder("right", cell.borders?.right);
          return `<td${span} style="${style}">${withFontFallback(cell.text ?? "")}</td>`;
        })
        .join("");
      const height = table.rowHeights[rowIndex];
      return `<tr${height ? ` style="height:${pt(height)}"` : ""}>${cells}</tr>`;
    })
    .join("");

  return `<table class="el table" style="${boxStyle(table)}"><colgroup>${columns}</colgroup><tbody>${rows}</tbody></table>`;
};

/** 그룹의 하위 요소 좌표는 그룹 기준이다. */
const renderGroup = (group: Group | { left: number; top: number; width: number; height: number; rotate?: number; isFlipH?: boolean; isFlipV?: boolean; elements: Element[] }) => {
  const flip = flipTransform(group);
  const transform = group.rotate || flip ? `transform:${group.rotate ? `rotate(${group.rotate}deg)` : ""}${flip};` : "";
  return `<div class="el" style="left:${pt(group.left)};top:${pt(group.top)};width:${pt(group.width)};height:${pt(group.height)};${transform}">${renderElements(group.elements)}</div>`;
};

const placeholder = (
  element: { left: number; top: number; width: number; height: number; rotate?: number },
  label: string,
  detail = ""
) =>
  `<div class="el placeholder" style="${boxStyle(element)}"><span>${escapeText(label)}</span>${detail}</div>`;

const renderElement = (element: Element): string => {
  switch (element.type) {
    case "shape":
      return renderShape(element);
    case "text":
      return renderText(element);
    case "image":
      return renderImage(element);
    case "table":
      return renderTable(element);
    case "group":
      return renderGroup(element);
    case "diagram":
      return element.elements.length > 0
        ? renderGroup({ ...element, elements: element.elements })
        : placeholder(
            element,
            "SmartArt",
            element.textList.length > 0
              ? `<ul>${element.textList.map((text) => `<li>${escapeText(text)}</li>`).join("")}</ul>`
              : ""
          );
    case "math":
      return isBlobUrl(element.picBlob)
        ? `<div class="el image" style="${boxStyle(element)}"><img src="${escapeAttribute(element.picBlob)}" alt="" style="width:100%;height:100%;left:0;top:0;object-fit:contain;"/></div>`
        : placeholder(element, "수식", element.text ? `<div>${escapeText(element.text)}</div>` : "");
    case "chart":
      return placeholder(element, "차트");
    case "video":
    case "audio":
      return placeholder(element, MEDIA_LABEL);
    default:
      return "";
  }
};

const renderElements = (elements: Element[]) => byOrder(elements).map(renderElement).join("");

/**
 * 슬라이드 하나를 독립된 HTML 문서로 만든다. 좌표는 pt 단위로 절대 배치한다.
 * 텍스트 HTML은 파일 내용에서 나오므로 스크립트를 허용하지 않는 샌드박스 iframe에서만 보여 준다.
 */
export const buildSlideDocument = (slide: Slide, size: SlideSize) => {
  const background = fillCss(slide.fill) || "background-color:#FFFFFF;";
  const styles = `
html,body{margin:0;padding:0;overflow:hidden;}
body{position:relative;width:${pt(size.width)};height:${pt(size.height)};${background}font-family:${FONT_FALLBACK};color:#000;}
.el{position:absolute;box-sizing:border-box;margin:0;}
.shape-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}
.text-layer{position:absolute;inset:0;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;word-break:break-word;}
.text-layer p{margin:0;}
.image{overflow:hidden;}
.image img{position:absolute;display:block;max-width:none;}
.table{border-collapse:collapse;table-layout:fixed;}
.table td{padding:3.6pt 7.2pt;box-sizing:border-box;overflow:hidden;}
.table td p{margin:0;}
.placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4pt;border:1pt dashed #9CA3AF;background:#F3F4F6;color:#6B7280;font-size:10pt;overflow:hidden;}
.placeholder ul{margin:0;padding-left:14pt;font-size:9pt;}
`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${styles}</style></head><body>${renderElements(slide.layoutElements ?? [])}${renderElements(slide.elements ?? [])}</body></html>`;
};
