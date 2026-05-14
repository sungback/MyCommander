import { beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import {
  __resetManualDirectorySizeScansForTests,
  cancelManualDirectorySizeScan,
  scanDirectorySizeWithProgress,
} from "./manualDirectorySizeScan";

const { listenHandlers } = vi.hoisted(() => ({
  listenHandlers: new Map<string, (event: { payload: unknown }) => void>(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockImplementation(
    async (eventName: string, handler: (event: { payload: unknown }) => void) => {
      listenHandlers.set(eventName, handler);
      return () => {
        listenHandlers.delete(eventName);
      };
    }
  ),
}));

const makeArgs = (overrides = {}) => ({
  cancelDirSizeScan: vi.fn().mockResolvedValue(undefined),
  panelId: "left" as const,
  path: "/cloud/My Drive",
  scanDirSize: vi.fn().mockResolvedValue({
    size: 2048,
    isPartial: false,
    scannedEntries: 2,
    errorCount: 0,
  }),
  setEntrySizeStatus: vi.fn(),
  updateEntrySize: vi.fn(),
  updateEntrySizeEstimate: vi.fn(),
  updateEntrySizeProgress: vi.fn(),
  ...overrides,
});

describe("manualDirectorySizeScan", () => {
  beforeEach(() => {
    __resetManualDirectorySizeScansForTests();
    listenHandlers.clear();
  });

  it("updates row progress before storing the exact result", async () => {
    const args = makeArgs({
      scanDirSize: vi.fn().mockImplementation(async (path: string, scanId: string) => {
        listenHandlers.get("dir-size-progress")?.({
          payload: {
            scanId,
            path,
            size: 1024,
            isPartial: true,
            scannedEntries: 1,
            completed: false,
          },
        });

        return {
          size: 2048,
          isPartial: false,
          scannedEntries: 2,
          errorCount: 0,
        };
      }),
    });

    const result = await scanDirectorySizeWithProgress(args);

    expect(args.setEntrySizeStatus).toHaveBeenCalledWith(
      "left",
      "/cloud/My Drive",
      "calculating"
    );
    expect(args.updateEntrySizeProgress).toHaveBeenCalledWith(
      "left",
      "/cloud/My Drive",
      1024
    );
    expect(args.updateEntrySize).toHaveBeenCalledWith(
      "left",
      "/cloud/My Drive",
      2048
    );
    expect(result).toEqual({
      status: "completed",
      size: 2048,
      isPartial: false,
    });
  });

  it("cancels an active scan and keeps the latest progress as partial", async () => {
    let capturedScanId = "";
    let rejectScan: (error: Error) => void = () => undefined;
    const args = makeArgs({
      scanDirSize: vi.fn().mockImplementation(
        (_path: string, scanId: string) =>
          new Promise((_resolve, reject) => {
            capturedScanId = scanId;
            rejectScan = reject;
          })
      ),
    });

    const scanPromise = scanDirectorySizeWithProgress(args);
    await waitFor(() => expect(capturedScanId).not.toBe(""));

    listenHandlers.get("dir-size-progress")?.({
      payload: {
        scanId: capturedScanId,
        path: "/cloud/My Drive",
        size: 4096,
        isPartial: true,
        scannedEntries: 4,
        completed: false,
      },
    });

    await expect(cancelManualDirectorySizeScan("/cloud/My Drive")).resolves.toBe(true);
    expect(args.cancelDirSizeScan).toHaveBeenCalledWith(capturedScanId);
    expect(args.updateEntrySizeEstimate).toHaveBeenCalledWith(
      "left",
      "/cloud/My Drive",
      4096,
      "partial"
    );

    rejectScan(new Error("Directory size scan cancelled"));
    await expect(scanPromise).resolves.toMatchObject({
      status: "cancelled",
      size: 4096,
      isPartial: true,
    });
  });
});
