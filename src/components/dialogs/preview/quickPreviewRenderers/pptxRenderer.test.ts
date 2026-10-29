import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { buildPptxHtml, defaultLoadPptxRenderer } from "./pptxRenderer";

const createPptxBuffer = async (slides: { name: string; xml: string }[]): Promise<ArrayBuffer> => {
  const zip = new JSZip();
  for (const slide of slides) {
    zip.file(slide.name, slide.xml);
  }
  return await zip.generateAsync({ type: "arraybuffer" });
};

describe("pptxRenderer", () => {
  it("renders slide cards and extracts text from drawingml elements", async () => {
    const slide1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p>
                  <a:r><a:t>First Slide Title</a:t></a:r>
                </a:p>
                <a:p>
                  <a:r><a:t>Subtitle text</a:t></a:r>
                </a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>`;

    const slide2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p>
                  <a:r><a:t>Second Slide Bullet &lt;1&gt;</a:t></a:r>
                </a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>`;

    const buffer = await createPptxBuffer([
      { name: "ppt/slides/slide2.xml", xml: slide2Xml },
      { name: "ppt/slides/slide1.xml", xml: slide1Xml },
    ]);

    const readFileBinary = vi.fn().mockResolvedValue(buffer);
    const html = await buildPptxHtml("/path/to/test.pptx", { readFileBinary });

    expect(readFileBinary).toHaveBeenCalledWith("/path/to/test.pptx");
    expect(html).toContain("슬라이드 1");
    expect(html).toContain("First Slide Title");
    expect(html).toContain("Subtitle text");
    expect(html).toContain("슬라이드 2");
    expect(html).toContain("Second Slide Bullet &lt;1&gt;");
  });

  it("handles slides with no text content", async () => {
    const emptySlideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld><p:spTree></p:spTree></p:cSld>
      </p:sld>`;

    const buffer = await createPptxBuffer([
      { name: "ppt/slides/slide1.xml", xml: emptySlideXml },
    ]);

    const readFileBinary = vi.fn().mockResolvedValue(buffer);
    const html = await buildPptxHtml("/path/to/empty.pptx", { readFileBinary });

    expect(html).toContain("슬라이드 1");
    expect(html).toContain("( 텍스트 없음 )");
  });

  it("returns fallback message when no slides are found", async () => {
    const buffer = await createPptxBuffer([
      { name: "[Content_Types].xml", xml: "<Types></Types>" },
    ]);

    const readFileBinary = vi.fn().mockResolvedValue(buffer);
    const html = await buildPptxHtml("/path/to/noslides.pptx", { readFileBinary });

    expect(html).toContain("슬라이드를 찾을 수 없습니다.");
  });

  it("truncates slides when exceeding maximum limit", async () => {
    const slides = Array.from({ length: 105 }, (_, i) => ({
      name: `ppt/slides/slide${i + 1}.xml`,
      xml: `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                    xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:t>Slide ${i + 1}</a:t>
            </p:sld>`,
    }));

    const buffer = await createPptxBuffer(slides);
    const readFileBinary = vi.fn().mockResolvedValue(buffer);
    const html = await buildPptxHtml("/path/to/many.pptx", { readFileBinary });

    expect(html).toContain("처음 100개 슬라이드만 표시됩니다 (전체 105개)");
    expect(html).toContain("슬라이드 100");
    expect(html).not.toContain("슬라이드 101");
  });

  it("loads via defaultLoadPptxRenderer factory with custom options", async () => {
    const buffer = await createPptxBuffer([
      {
        name: "ppt/slides/slide1.xml",
        xml: `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:t>Sample</a:t>
              </p:sld>`,
      },
    ]);

    const readFileBinary = vi.fn().mockResolvedValue(buffer);
    const renderer = await defaultLoadPptxRenderer({ readFileBinary });
    const html = await renderer.renderPptx("/path/to/sample.pptx");

    expect(html).toContain("Sample");
  });
});
