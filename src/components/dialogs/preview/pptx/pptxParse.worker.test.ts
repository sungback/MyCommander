import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("pptxtojson", () => ({ parse: vi.fn() }));

import { parse } from "pptxtojson";

type WorkerMessageHandler = (event: MessageEvent<ArrayBuffer>) => Promise<void>;

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe("pptxParse.worker", () => {
  let handleMessage: WorkerMessageHandler;
  let postMessage: ReturnType<typeof vi.spyOn>;
  let createdUrlCount = 0;

  beforeAll(async () => {
    URL.createObjectURL = vi.fn(() => `blob:worker-${++createdUrlCount}`);
    URL.revokeObjectURL = vi.fn();
    // Worker 모듈은 불러올 때 URL.createObjectURL을 감싸고 onmessage를 등록한다.
    await import("./pptxParse.worker");
    handleMessage = self.onmessage as unknown as WorkerMessageHandler;
  });

  beforeEach(() => {
    vi.mocked(parse).mockReset();
    vi.mocked(URL.revokeObjectURL).mockClear();
    postMessage = vi.spyOn(self, "postMessage").mockImplementation(() => undefined);
  });

  afterEach(() => {
    postMessage.mockRestore();
  });

  afterAll(() => {
    self.onmessage = null;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("posts parsed slides with the blobs behind their object URLs, then revokes them", async () => {
    const image = new Blob(["image"]);
    let url = "";
    vi.mocked(parse).mockImplementation(async () => {
      url = URL.createObjectURL(image);
      return {
        size: { width: 960, height: 540 },
        slides: [{ fill: { type: "color", value: "#fff" }, elements: [{ type: "image", blob: url }], layoutElements: [], note: "" }],
        themeColors: [],
        usedFonts: [],
      } as unknown as Awaited<ReturnType<typeof parse>>;
    });
    const bytes = new ArrayBuffer(4);

    await handleMessage({ data: bytes } as MessageEvent<ArrayBuffer>);

    expect(parse).toHaveBeenCalledWith(bytes, {
      imageMode: "blob",
      videoMode: "none",
      audioMode: "none",
    });
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, blobs: [[url, image]] })
    );
    expect(url).toMatch(/^blob:worker-/);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  });

  it("posts the error message when parsing fails", async () => {
    vi.mocked(parse).mockRejectedValue(new Error("Cannot read Override"));

    await handleMessage({ data: new ArrayBuffer(4) } as MessageEvent<ArrayBuffer>);

    expect(postMessage).toHaveBeenCalledWith({ ok: false, message: "Cannot read Override" });
  });
});
