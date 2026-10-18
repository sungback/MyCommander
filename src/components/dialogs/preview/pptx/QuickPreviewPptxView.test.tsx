import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Slide } from "pptxtojson";
import { QuickPreviewPptxView, type PptxDeckModule } from "./QuickPreviewPptxView";
import type { PptxDeck } from "./pptxDeck";

const makeSlide = (text: string): Slide => ({
  fill: { type: "color", value: "#FFFFFF" },
  layoutElements: [],
  note: "",
  elements: [
    {
      type: "text",
      id: text,
      name: text,
      left: 10,
      top: 10,
      width: 200,
      height: 40,
      order: 1,
      rotate: 0,
      isFlipH: false,
      isFlipV: false,
      isVertical: false,
      borderColor: "#000000",
      borderWidth: 0,
      borderType: "solid",
      borderStrokeDasharray: "0",
      fill: { type: "color", value: "#FFFFFF" },
      content: `<p>${text}</p>`,
      vAlign: "up",
      wrap: true,
    },
  ],
});

const makeDeck = (count: number) => {
  const dispose = vi.fn();
  const deck: PptxDeck = {
    size: { width: 960, height: 540 },
    slides: Array.from({ length: count }, (_, index) => makeSlide(`슬라이드${index + 1}`)),
    dispose,
  };
  return { deck, dispose };
};

const okFetch = () =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, arrayBuffer: async () => new Uint8Array([80, 75]).buffer });

const textRenderer = (html = "<html><body>텍스트 목록</body></html>") => {
  const renderPptx = vi.fn().mockResolvedValue(html);
  const loadTextRenderer = vi.fn(async (readFileBinary: (path: string) => Promise<ArrayBuffer | Uint8Array>) => ({
    renderPptx: async (path: string) => {
      await readFileBinary(path);
      return renderPptx(path);
    },
  }));
  return { loadTextRenderer, renderPptx };
};

const renderView = (options: {
  deckModule: PptxDeckModule;
  fetchImpl?: typeof fetch;
  readFileBinary?: (path: string) => Promise<ArrayBuffer | Uint8Array>;
  loadTextRenderer?: ReturnType<typeof textRenderer>["loadTextRenderer"];
}) =>
  render(
    <QuickPreviewPptxView
      src="asset://localhost/decks/talk.pptx"
      filePath="/decks/talk.pptx"
      fetchImpl={options.fetchImpl ?? (okFetch() as unknown as typeof fetch)}
      readFileBinary={options.readFileBinary ?? vi.fn()}
      loadDeckModule={async () => options.deckModule}
      loadTextRenderer={options.loadTextRenderer ?? textRenderer().loadTextRenderer}
    />
  );

const pressKey = (key: string) => {
  act(() => {
    fireEvent.keyDown(window, { key });
  });
};

describe("QuickPreviewPptxView", () => {
  it("shows slide thumbnails and moves one slide at a time", async () => {
    const { deck } = makeDeck(3);
    renderView({ deckModule: { parsePptxDeck: vi.fn().mockResolvedValue(deck) } });

    expect(await screen.findByText("1 / 3")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /번 슬라이드로 이동/ })).toHaveLength(3);
    expect(await screen.findByTitle("1번 슬라이드")).toHaveAttribute("sandbox", "allow-same-origin");

    pressKey("ArrowDown");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByTitle("2번 슬라이드").getAttribute("srcdoc")).toContain("슬라이드2");
    pressKey("End");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1번 슬라이드로 이동" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("reads the file directly when the asset URL cannot be fetched", async () => {
    const { deck } = makeDeck(1);
    const parsePptxDeck = vi.fn().mockResolvedValue(deck);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch;
    const readFileBinary = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));

    renderView({ deckModule: { parsePptxDeck }, fetchImpl, readFileBinary });

    expect(await screen.findByText("1 / 1")).toBeInTheDocument();
    expect(readFileBinary).toHaveBeenCalledWith("/decks/talk.pptx");
    expect(new Uint8Array(parsePptxDeck.mock.calls[0][0])).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("falls back to the text view with the reason when parsing fails", async () => {
    const { loadTextRenderer, renderPptx } = textRenderer();
    const readFileBinary = vi.fn();
    renderView({
      deckModule: { parsePptxDeck: vi.fn().mockRejectedValue(new Error("Cannot read Override")) },
      readFileBinary,
      loadTextRenderer,
    });

    expect(await screen.findByText(/슬라이드를 그리지 못해 텍스트로 보여 줍니다: Cannot read Override/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTitle("rendered preview")).toBeInTheDocument());
    expect(renderPptx).toHaveBeenCalledWith("/decks/talk.pptx");
    // 이미 읽은 원본을 다시 쓰므로 파일을 또 읽지 않는다.
    expect(readFileBinary).not.toHaveBeenCalled();
  });

  it("switches between slide and text views", async () => {
    const { deck } = makeDeck(2);
    renderView({ deckModule: { parsePptxDeck: vi.fn().mockResolvedValue(deck) } });

    fireEvent.click(await screen.findByRole("button", { name: "텍스트 보기" }));
    await waitFor(() => expect(screen.getByTitle("rendered preview")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "슬라이드 보기" }));

    expect(await screen.findByText("1 / 2")).toBeInTheDocument();
  });

  it("releases thumbnail documents that scroll out of the list", async () => {
    const observers: Array<{ element: Element; callback: IntersectionObserverCallback }> = [];
    class StubIntersectionObserver {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(element: Element) {
        observers.push({ element, callback: this.callback });
      }
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", StubIntersectionObserver);
    const setVisible = (label: string, isIntersecting: boolean) => {
      const matches = observers.filter(({ element }) => element.getAttribute("aria-label") === label);
      const target = matches[matches.length - 1];
      act(() => {
        target?.callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
      });
    };
    try {
      const { deck } = makeDeck(3);
      renderView({ deckModule: { parsePptxDeck: vi.fn().mockResolvedValue(deck) } });
      await screen.findByText("1 / 3");

      setVisible("2번 슬라이드로 이동", true);
      expect(screen.getByTitle("2번 슬라이드 썸네일")).toBeInTheDocument();
      setVisible("2번 슬라이드로 이동", false);
      expect(screen.queryByTitle("2번 슬라이드 썸네일")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("releases slide images when the preview closes", async () => {
    const { deck, dispose } = makeDeck(2);
    const { unmount } = renderView({ deckModule: { parsePptxDeck: vi.fn().mockResolvedValue(deck) } });
    await screen.findByText("1 / 2");

    unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
