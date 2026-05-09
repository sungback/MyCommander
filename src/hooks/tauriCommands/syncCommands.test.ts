import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncCommands } from "./syncCommands";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

beforeEach(() => {
  mockInvoke.mockReset();
});

const makeRawItem = (status: string) => ({
  rel_path: "file.txt",
  left_path: "/left/file.txt",
  right_path: "/right/file.txt",
  left_kind: "file",
  right_kind: "file",
  status,
});

describe("syncCommands", () => {
  describe("compareDirectories", () => {
    it("calls compare_directories with snake_case args", async () => {
      mockInvoke.mockResolvedValue([]);
      await syncCommands.compareDirectories("/left", "/right");
      expect(mockInvoke).toHaveBeenCalledWith("compare_directories", {
        left: "/left",
        right: "/right",
        show_hidden: false,
      });
    });

    it("maps raw snake_case fields to camelCase", async () => {
      mockInvoke.mockResolvedValue([makeRawItem("Identical")]);
      const result = await syncCommands.compareDirectories("/left", "/right");
      expect(result[0]).toMatchObject({
        relPath: "file.txt",
        leftPath: "/left/file.txt",
        rightPath: "/right/file.txt",
        leftKind: "file",
        rightKind: "file",
        status: "Identical",
      });
    });

    it("LeftOnly → direction: toRight", async () => {
      mockInvoke.mockResolvedValue([makeRawItem("LeftOnly")]);
      const result = await syncCommands.compareDirectories("/left", "/right");
      expect(result[0].direction).toBe("toRight");
    });

    it("LeftNewer → direction: toRight", async () => {
      mockInvoke.mockResolvedValue([makeRawItem("LeftNewer")]);
      const result = await syncCommands.compareDirectories("/left", "/right");
      expect(result[0].direction).toBe("toRight");
    });

    it("RightOnly → direction: toLeft", async () => {
      mockInvoke.mockResolvedValue([makeRawItem("RightOnly")]);
      const result = await syncCommands.compareDirectories("/left", "/right");
      expect(result[0].direction).toBe("toLeft");
    });

    it("RightNewer → direction: toLeft", async () => {
      mockInvoke.mockResolvedValue([makeRawItem("RightNewer")]);
      const result = await syncCommands.compareDirectories("/left", "/right");
      expect(result[0].direction).toBe("toLeft");
    });

    it("Identical → direction: skip", async () => {
      mockInvoke.mockResolvedValue([makeRawItem("Identical")]);
      const result = await syncCommands.compareDirectories("/left", "/right");
      expect(result[0].direction).toBe("skip");
    });

    it("Unknown status → direction: skip", async () => {
      mockInvoke.mockResolvedValue([makeRawItem("Unknown")]);
      const result = await syncCommands.compareDirectories("/left", "/right");
      expect(result[0].direction).toBe("skip");
    });

    it("passes show_hidden: true when arg is true", async () => {
      mockInvoke.mockResolvedValue([]);
      await syncCommands.compareDirectories("/left", "/right", true);
      expect(mockInvoke).toHaveBeenCalledWith("compare_directories", {
        left: "/left",
        right: "/right",
        show_hidden: true,
      });
    });
  });

  describe("syncWatchedDirectories", () => {
    it("calls sync_watched_directories with paths", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await syncCommands.syncWatchedDirectories(["/a", "/b"]);
      expect(mockInvoke).toHaveBeenCalledWith("sync_watched_directories", {
        paths: ["/a", "/b"],
      });
    });
  });
});
