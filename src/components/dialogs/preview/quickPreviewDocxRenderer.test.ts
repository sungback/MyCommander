import { describe, expect, it } from "vitest";
import { renderDocxDocumentXml } from "./quickPreviewDocxRenderer";

describe("renderDocxDocumentXml", () => {
  it("renders paragraphs and tables from document.xml", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p>
            <w:r><w:t>Hello</w:t></w:r>
            <w:r><w:tab/></w:r>
            <w:r><w:t>World</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:t>Line 1</w:t></w:r>
            <w:r><w:br/></w:r>
            <w:r><w:t>Line 2</w:t></w:r>
          </w:p>
          <w:tbl>
            <w:tr>
              <w:tc><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc>
            </w:tr>
            <w:tr>
              <w:tc><w:p><w:r><w:t>A2</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>B2</w:t></w:r></w:p></w:tc>
            </w:tr>
          </w:tbl>
        </w:body>
      </w:document>`;

    const html = renderDocxDocumentXml(xml);

    expect(html).toContain('<p class="docx-paragraph">Hello&emsp;World</p>');
    expect(html).toContain("Line 1<br/>Line 2");
    expect(html).toContain("<table");
    expect(html).toContain("<td><p class=\"docx-paragraph\">A1</p></td>");
    expect(html).toContain("<td><p class=\"docx-paragraph\">B2</p></td>");
  });

  it("returns a fallback message when no readable body content exists", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:sectPr />
        </w:body>
      </w:document>`;

    const html = renderDocxDocumentXml(xml);

    expect(html).toContain("표시할 텍스트를 찾을 수 없습니다.");
  });
});
