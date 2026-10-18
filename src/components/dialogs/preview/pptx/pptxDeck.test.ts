import { describe, expect, it, vi } from "vitest";
import type { Slide } from "pptxtojson";

vi.mock("pptxtojson", () => ({ parse: vi.fn() }));

import { parse } from "pptxtojson";
import { collectDeckBlobUrls, parsePptxDeck } from "./pptxDeck";

const slides = [
  {
    fill: { type: "image", value: { ref: "", base64: "", blob: "blob:bg", opacity: 1 } },
    layoutElements: [{ type: "image", blob: "blob:layout" }],
    elements: [
      { type: "group", elements: [{ type: "image", blob: "blob:nested" }, { type: "shape", fill: { type: "image", value: { blob: "blob:shape-fill" } } }] },
      { type: "math", picBlob: "blob:math" },
      { type: "image", blob: "" },
    ],
    note: "",
  },
] as unknown as Slide[];

describe("pptxDeck", () => {
  it("collects every image object URL including nested and fill images", () => {
    expect([...collectDeckBlobUrls(slides)].sort()).toEqual([
      "blob:bg",
      "blob:layout",
      "blob:math",
      "blob:nested",
      "blob:shape-fill",
    ]);
  });

  it("revokes collected object URLs when disposed", async () => {
    vi.mocked(parse).mockResolvedValue({ slides, size: { width: 960, height: 540 }, themeColors: [], usedFonts: [] });
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const deck = await parsePptxDeck(new ArrayBuffer(4));
    deck.dispose();

    expect(parse).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      imageMode: "blob",
      videoMode: "none",
      audioMode: "none",
    });
    expect(revoke).toHaveBeenCalledTimes(5);
    revoke.mockRestore();
  });
});
