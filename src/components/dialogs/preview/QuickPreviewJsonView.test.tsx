import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QuickPreviewJsonView } from "./QuickPreviewJsonView";

describe("QuickPreviewJsonView", () => {
  const sampleJson = JSON.stringify({
    name: "MyCommander",
    version: "1.2.34",
    active: true,
    count: 42,
    empty: null,
    website: "https://example.com",
    tags: ["file-manager", "tauri"],
    nested: {
      key: "val",
    },
  });

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders JSON in tree view mode by default", () => {
    render(
      <QuickPreviewJsonView
        content={sampleJson}
      />
    );

    // Check tree mode elements
    expect(screen.getByText('"name":')).toBeInTheDocument();
    expect(screen.getByText('"MyCommander"')).toBeInTheDocument();
    expect(screen.getByText('"count":')).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(screen.getByText("null")).toBeInTheDocument();

    // Check URL link
    const link = screen.getByRole("link", { name: "https://example.com" });
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("toggles between Tree and Code view modes", () => {
    render(
      <QuickPreviewJsonView
        content={sampleJson}
      />
    );

    const codeBtn = screen.getByTitle("코드 형식으로 보기");
    fireEvent.click(codeBtn);

    // Code view has line numbers
    expect(screen.getByText("1")).toBeInTheDocument();

    const treeBtn = screen.getByTitle("트리 형식으로 보기");
    fireEvent.click(treeBtn);

    // Back to tree view
    expect(screen.getByText('"name":')).toBeInTheDocument();
  });

  it("filters keys or values via search input and can clear", () => {
    render(
      <QuickPreviewJsonView
        content={sampleJson}
      />
    );

    const searchInput = screen.getByPlaceholderText("키 또는 값 검색...");
    fireEvent.change(searchInput, { target: { value: "MyCommander" } });

    // Mark element should appear for matching text
    expect(screen.getByText("MyCommander")).toBeInTheDocument();

    // Clear search
    const clearBtn = screen.getByTitle("검색어 지우기");
    fireEvent.click(clearBtn);
    expect(searchInput).toHaveValue("");
  });

  it("expands and collapses all tree nodes", () => {
    render(
      <QuickPreviewJsonView
        content={sampleJson}
      />
    );

    const collapseAllBtn = screen.getByTitle("모두 접기");
    fireEvent.click(collapseAllBtn);

    // Root object has 8 keys, so when collapsed it shows "8 keys"
    expect(screen.getByText("8 keys")).toBeInTheDocument();

    const expandAllBtn = screen.getByTitle("모두 펼치기");
    fireEvent.click(expandAllBtn);

    // Expanded again: key inside nested object should be visible
    expect(screen.getByText('"key":')).toBeInTheDocument();
  });

  it("copies formatted JSON to clipboard", async () => {
    render(
      <QuickPreviewJsonView
        content={sampleJson}
      />
    );

    const copyBtn = screen.getByTitle("포맷된 JSON 복사");
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify(JSON.parse(sampleJson), null, 2)
    );
    expect(await screen.findByText("복사됨")).toBeInTheDocument();
  });

  it("handles invalid JSON gracefully by falling back to raw view with banner", () => {
    const invalidJson = "{ not valid json: 123 ";
    render(
      <QuickPreviewJsonView
        content={invalidJson}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "유효하지 않은 JSON 구문이 포함되어 있어 원본 코드로 표시합니다"
    );
    // Tree button should be disabled
    expect(screen.getByTitle("트리 형식으로 보기")).toBeDisabled();
    // Raw code should be displayed
    expect(screen.getByText(/not valid json/)).toBeInTheDocument();
  });
});
