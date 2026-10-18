import { describe, expect, it } from "vitest";
import type { Element, Slide } from "pptxtojson";
import { buildSlideDocument, withFontFallback } from "./pptxSlideHtml";

const SIZE = { width: 960, height: 540 };
const base = { id: "1", left: 10, top: 20, width: 100, height: 50, order: 1, rotate: 0, isFlipH: false, isFlipV: false };
const border = { borderColor: "#000000", borderWidth: 0, borderType: "solid" as const, borderStrokeDasharray: "0" };

const slideWith = (elements: Element[], extra: Partial<Slide> = {}): Slide => ({
  fill: { type: "color", value: "#FFFFFF" },
  elements,
  layoutElements: [],
  note: "",
  ...extra,
});

const parseBody = (html: string) => new DOMParser().parseFromString(html, "text/html").body;

describe("pptxSlideHtml", () => {
  it("appends Korean fallback fonts without breaking the style attribute", () => {
    const html = withFontFallback(
      '<p><span style="font-size: 18pt;font-family: NanumGothic;font-weight: bold;color: #FF0000;">가</span>' +
        '<span style="font-family: 더잠실 2 Light;">나</span></p>'
    );
    const [first, second] = Array.from(
      new DOMParser().parseFromString(html, "text/html").querySelectorAll("span")
    );

    expect(first.style.fontFamily).toBe(`"NanumGothic", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`);
    // 대체 글꼴을 넣은 뒤에도 같은 속성의 다른 선언이 살아 있어야 한다.
    expect(first.style.fontWeight).toBe("bold");
    expect(first.style.color).toBe("rgb(255, 0, 0)");
    // 숫자로 시작하는 단어가 있는 글꼴 이름도 따옴표로 감싸 유효한 선언이 된다.
    expect(second.style.fontFamily).toContain(`"더잠실 2 Light"`);
  });

  it("positions a text box in pt and keeps its rich text", () => {
    const html = buildSlideDocument(
      slideWith([
        {
          ...base,
          ...border,
          type: "text",
          name: "Title",
          content: '<p><span style="font-family: Pretendard;">안녕하세요</span></p>',
          vAlign: "mid",
          wrap: true,
          isVertical: false,
          fill: { type: "color", value: "#FFEEDD" },
          autoFit: { type: "text", fontScale: 50 },
        },
      ]),
      SIZE
    );
    const box = parseBody(html).querySelector(".el") as HTMLElement;

    expect(box.getAttribute("style")).toContain("left:10pt;top:20pt;width:100pt;height:50pt;");
    expect(box.getAttribute("style")).toContain("background-color:#FFEEDD;");
    expect(box.textContent).toBe("안녕하세요");
    expect(html).toContain("justify-content:center;");
    expect(html).toContain("zoom:0.5;");
    expect(html).toContain("font-family: 'Pretendard', 'Apple SD Gothic Neo'");
  });

  it("draws shapes from their SVG path with fill, stroke and arrow markers", () => {
    const html = buildSlideDocument(
      slideWith([
        {
          ...base,
          ...border,
          borderColor: "#FF0000",
          borderWidth: 2,
          type: "shape",
          name: "Arrow",
          shapType: "custom",
          content: "",
          vAlign: "mid",
          wrap: true,
          path: "M0,0 L100,50",
          pathViewBox: { x: 0, y: 0, width: 100, height: 50 },
          fill: {
            type: "gradient",
            value: { path: "line", rot: 90, colors: [{ pos: "0%", color: "#000000" }, { pos: "100%", color: "#FFFFFF" }] },
          },
          tailEnd: { type: "triangle" },
        },
      ]),
      SIZE
    );
    const body = parseBody(html);
    const path = body.querySelector("path:not(marker path)") as SVGPathElement;

    expect(body.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 100 50");
    expect(path.getAttribute("d")).toBe("M0,0 L100,50");
    expect(path.getAttribute("stroke")).toBe("#FF0000");
    expect(path.getAttribute("stroke-width")).toBe("2");
    expect(path.getAttribute("fill")).toMatch(/^url\(#s\d+-fill\)$/);
    expect(path.getAttribute("marker-end")).toMatch(/^url\(#s\d+-tail\)$/);
    expect(body.querySelectorAll("defs stop")).toHaveLength(2);
  });

  it("crops images by percentage and skips images without a blob URL", () => {
    const image = {
      ...base,
      ...border,
      type: "image" as const,
      ref: "",
      base64: "",
      geom: "ellipse",
      rect: { l: 10, r: 30, t: 0, b: 50 },
    };
    const html = buildSlideDocument(
      slideWith([{ ...image, blob: "blob:app/1" }, { ...image, id: "2", order: 2, blob: "" }]),
      SIZE
    );
    const body = parseBody(html);
    const img = body.querySelector("img") as HTMLImageElement;

    expect(img.getAttribute("src")).toBe("blob:app/1");
    // 보이는 폭 60%, 높이 50% → 원본은 상자의 166.67% × 200%, 왼쪽으로 16.67% 이동
    expect(img.getAttribute("style")).toContain("width:166.66666666666669%;height:200%;");
    expect(img.getAttribute("style")).toContain("left:-16.666666666666664%;top:0%;");
    expect(body.querySelector(".image")?.getAttribute("style")).toContain("border-radius:50%;");
    expect(body.querySelector(".placeholder")?.textContent).toBe("이미지");
  });

  it("shows a placeholder for image formats the webview cannot display", () => {
    const html = buildSlideDocument(
      slideWith([
        {
          ...base,
          ...border,
          type: "image",
          ref: "ppt/media/image3.emf",
          base64: "",
          blob: "blob:app/emf",
          geom: "rect",
        },
      ]),
      SIZE
    );
    const body = parseBody(html);

    expect(body.querySelector("img")).toBeNull();
    expect(body.querySelector(".placeholder")?.textContent).toBe("이미지 (EMF)");
  });

  it("places group children relative to the group and sorts by order", () => {
    const child = (id: string, order: number, content: string): Element => ({
      ...base,
      ...border,
      id,
      order,
      left: 5,
      top: 5,
      type: "text",
      name: id,
      content,
      vAlign: "up",
      wrap: true,
      isVertical: false,
      fill: { type: "color", value: "#FFFFFF" },
    });
    const html = buildSlideDocument(
      slideWith([
        {
          ...base,
          type: "group",
          left: 200,
          top: 100,
          elements: [child("b", 2, "<p>위</p>"), child("a", 1, "<p>아래</p>")] as never,
        },
      ]),
      SIZE
    );
    const group = parseBody(html).querySelector(".el") as HTMLElement;

    expect(group.getAttribute("style")).toContain("left:200pt;top:100pt;");
    expect(Array.from(group.querySelectorAll(":scope > .el")).map((element) => element.textContent)).toEqual([
      "아래",
      "위",
    ]);
  });

  it("renders tables without merged-away cells", () => {
    const cell = (text: string, extra = {}) => ({ text, vAlign: "mid", borders: {}, ...extra });
    const html = buildSlideDocument(
      slideWith([
        {
          ...base,
          type: "table",
          borders: {},
          colWidths: [50, 50],
          rowHeights: [20, 20],
          data: [
            [cell("<p>제목</p>", { colSpan: 2, fillColor: "#DDDDDD", fontBold: true }), cell("", { hMerge: 1 })],
            [cell("<p>A</p>"), cell("<p>B</p>")],
          ],
        },
      ]),
      SIZE
    );
    const table = parseBody(html).querySelector("table") as HTMLTableElement;

    expect(table.querySelectorAll("tr:first-child td")).toHaveLength(1);
    expect(table.querySelector("td")?.getAttribute("colspan")).toBe("2");
    expect(table.querySelector("td")?.getAttribute("style")).toContain("background-color:#DDDDDD;");
    expect(table.querySelectorAll("tr:last-child td")).toHaveLength(2);
  });

  it("shows placeholders for charts, media and SmartArt text", () => {
    const html = buildSlideDocument(
      slideWith([
        { ...base, type: "chart", chartType: "barChart", data: [], colors: [] } as unknown as Element,
        { ...base, id: "2", order: 2, type: "video", ref: "", blob: "" },
        { ...base, id: "3", order: 3, type: "diagram", elements: [], textList: ["하나", "<둘>"] },
      ]),
      SIZE
    );
    const placeholders = Array.from(parseBody(html).querySelectorAll(".placeholder")).map(
      (element) => element.textContent
    );

    expect(placeholders).toEqual(["차트", "미디어", "SmartArt하나<둘>"]);
    expect(html).toContain("&lt;둘&gt;");
  });

  it("draws the slide background and layout elements beneath slide elements", () => {
    const html = buildSlideDocument(
      slideWith(
        [{ ...base, ...border, type: "text", name: "front", content: "<p>앞</p>", vAlign: "up", wrap: true, isVertical: false, fill: { type: "color", value: "#FFFFFF" } }],
        {
          fill: { type: "image", value: { ref: "", base64: "", blob: "blob:app/bg", opacity: 1 } },
          layoutElements: [{ ...base, ...border, id: "9", type: "text", name: "back", content: "<p>뒤</p>", vAlign: "up", wrap: true, isVertical: false, fill: { type: "color", value: "#FFFFFF" } }],
        }
      ),
      SIZE
    );
    const body = parseBody(html);

    expect(html).toContain('background-image:url("blob:app/bg")');
    expect(Array.from(body.querySelectorAll(":scope > .el")).map((element) => element.textContent)).toEqual([
      "뒤",
      "앞",
    ]);
  });

  it("escapes attribute values that come from the file", () => {
    const html = buildSlideDocument(
      slideWith([
        {
          ...base,
          ...border,
          type: "text",
          name: "x",
          content: "",
          vAlign: "up",
          wrap: true,
          isVertical: false,
          fill: { type: "color", value: '#000;" onload="alert(1)' },
        },
      ]),
      SIZE
    );

    expect(html).not.toContain('" onload="');
    expect(html).toContain("&quot; onload=&quot;");
  });
});
