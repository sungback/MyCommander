import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Slide } from "pptxtojson";

vi.mock("pptxtojson", () => ({ parse: vi.fn() }));

import { parse } from "pptxtojson";
import { collectDeckBlobUrls, parsePptxDeck, replaceBlobUrls } from "./pptxDeck";
import type { PptxParseResponse } from "./pptxParseProtocol";

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

const workerSlides = () =>
  [
    {
      fill: { type: "image", value: { blob: "blob:worker-bg" } },
      layoutElements: [],
      elements: [{ type: "group", elements: [{ type: "image", blob: "blob:worker-img" }] }],
      note: "",
    },
  ] as unknown as Slide[];

class FakeWorker {
  onmessage: ((event: MessageEvent<PptxParseResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  respond(data: PptxParseResponse) {
    this.onmessage?.({ data } as MessageEvent<PptxParseResponse>);
  }

  failToLoad() {
    this.onerror?.({ preventDefault: vi.fn() } as unknown as ErrorEvent);
  }
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe("pptxDeck", () => {
  let createdUrlCount = 0;

  beforeEach(() => {
    createdUrlCount = 0;
    vi.mocked(parse).mockReset();
    URL.createObjectURL = vi.fn(() => `blob:main-${++createdUrlCount}`);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("collects every image object URL including nested and fill images", () => {
    expect([...collectDeckBlobUrls(slides)].sort()).toEqual([
      "blob:bg",
      "blob:layout",
      "blob:math",
      "blob:nested",
      "blob:shape-fill",
    ]);
  });

  it("replaces mapped object URLs anywhere in the parsed result", () => {
    const value = { a: ["blob:old", { b: "blob:old" }], c: "blob:other", d: 1, e: null };

    replaceBlobUrls(value, new Map([["blob:old", "blob:new"]]));

    expect(value).toEqual({ a: ["blob:new", { b: "blob:new" }], c: "blob:other", d: 1, e: null });
  });

  it("parses in a worker and recreates its object URLs on this side", async () => {
    const worker = new FakeWorker();
    const bytes = new ArrayBuffer(4);
    const pending = parsePptxDeck(bytes, { createWorker: () => worker as unknown as Worker });

    expect(worker.postMessage).toHaveBeenCalledWith(bytes);
    worker.respond({
      ok: true,
      size: { width: 960, height: 540 },
      slides: workerSlides(),
      blobs: [
        ["blob:worker-bg", new Blob(["bg"])],
        ["blob:worker-img", new Blob(["img"])],
      ],
    });
    const deck = await pending;

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(parse).not.toHaveBeenCalled();
    expect([...collectDeckBlobUrls(deck.slides)].sort()).toEqual(["blob:main-1", "blob:main-2"]);

    deck.dispose();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:main-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:main-2");
  });

  it("rejects with the worker's parse error", async () => {
    const worker = new FakeWorker();
    const pending = parsePptxDeck(new ArrayBuffer(4), {
      createWorker: () => worker as unknown as Worker,
    });

    worker.respond({ ok: false, message: "Cannot read Override" });

    await expect(pending).rejects.toThrow("Cannot read Override");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(parse).not.toHaveBeenCalled();
  });

  it("falls back to parsing on this thread when the worker script cannot load", async () => {
    vi.mocked(parse).mockResolvedValue({ slides, size: { width: 960, height: 540 }, themeColors: [], usedFonts: [] });
    const worker = new FakeWorker();
    const pending = parsePptxDeck(new ArrayBuffer(4), {
      createWorker: () => worker as unknown as Worker,
    });

    worker.failToLoad();
    const deck = await pending;

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(deck.slides).toBe(slides);
  });

  it("parses on this thread and revokes its object URLs when no worker is available", async () => {
    vi.mocked(parse).mockResolvedValue({ slides, size: { width: 960, height: 540 }, themeColors: [], usedFonts: [] });

    const deck = await parsePptxDeck(new ArrayBuffer(4), { createWorker: () => null });
    deck.dispose();

    expect(parse).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      imageMode: "blob",
      videoMode: "none",
      audioMode: "none",
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(5);
  });

  it("terminates the worker when aborted", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const pending = parsePptxDeck(new ArrayBuffer(4), {
      signal: controller.signal,
      createWorker: () => worker as unknown as Worker,
    });

    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("does not start a worker when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const createWorker = vi.fn(() => null);

    await expect(
      parsePptxDeck(new ArrayBuffer(4), { signal: controller.signal, createWorker })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(createWorker).not.toHaveBeenCalled();
  });
});
