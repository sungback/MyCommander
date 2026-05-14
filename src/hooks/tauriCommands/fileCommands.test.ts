import { describe, it, expect, vi, beforeEach } from "vitest";
import { fileCommands } from "./fileCommands";
import type { FileEntry } from "../../types/file";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

beforeEach(() => {
  mockInvoke.mockReset();
});

describe("fileCommands", () => {
  describe("listDirectory", () => {
    it("calls list_directory with show_hidden: false by default", async () => {
      mockInvoke.mockResolvedValue([]);
      await fileCommands.listDirectory("/some/path");
      expect(mockInvoke).toHaveBeenCalledWith("list_directory", {
        path: "/some/path",
        show_hidden: false,
      });
    });

    it("passes show_hidden: true when arg is true", async () => {
      mockInvoke.mockResolvedValue([]);
      await fileCommands.listDirectory("/some/path", true);
      expect(mockInvoke).toHaveBeenCalledWith("list_directory", {
        path: "/some/path",
        show_hidden: true,
      });
    });

    it("rethrows on error", async () => {
      const err = new Error("permission denied");
      mockInvoke.mockRejectedValue(err);
      await expect(fileCommands.listDirectory("/some/path")).rejects.toThrow("permission denied");
    });

    it("returns FileEntry[] from invoke", async () => {
      const entries: FileEntry[] = [
        { name: "file.txt", path: "/some/path/file.txt", kind: "file", size: 100, lastModified: 0 },
      ];
      mockInvoke.mockResolvedValue(entries);
      const result = await fileCommands.listDirectory("/some/path");
      expect(result).toEqual(entries);
    });
  });

  describe("createDirectory", () => {
    it("calls create_directory with { path }", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await fileCommands.createDirectory("/new/dir");
      expect(mockInvoke).toHaveBeenCalledWith("create_directory", { path: "/new/dir" });
    });
  });

  describe("createFile", () => {
    it("calls create_file with { path }", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await fileCommands.createFile("/new/file.txt");
      expect(mockInvoke).toHaveBeenCalledWith("create_file", { path: "/new/file.txt" });
    });
  });

  describe("deleteFiles", () => {
    it("calls delete_files with permanent: false by default", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await fileCommands.deleteFiles(["/a.txt", "/b.txt"]);
      expect(mockInvoke).toHaveBeenCalledWith("delete_files", {
        paths: ["/a.txt", "/b.txt"],
        permanent: false,
      });
    });

    it("passes permanent: true when specified", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await fileCommands.deleteFiles(["/a.txt"], true);
      expect(mockInvoke).toHaveBeenCalledWith("delete_files", {
        paths: ["/a.txt"],
        permanent: true,
      });
    });
  });

  describe("copyFiles", () => {
    it("calls copy_files with snake_case keys and defaults keep_both/overwrite to false when undefined", async () => {
      mockInvoke.mockResolvedValue([]);
      await fileCommands.copyFiles(["/src/a.txt"], "/dst");
      expect(mockInvoke).toHaveBeenCalledWith("copy_files", {
        source_paths: ["/src/a.txt"],
        target_path: "/dst",
        keep_both: false,
        overwrite: false,
      });
    });

    it("passes provided keepBoth and overwrite when given", async () => {
      mockInvoke.mockResolvedValue(["/dst/a (copy).txt"]);
      const result = await fileCommands.copyFiles(["/src/a.txt"], "/dst", true, true);
      expect(mockInvoke).toHaveBeenCalledWith("copy_files", {
        source_paths: ["/src/a.txt"],
        target_path: "/dst",
        keep_both: true,
        overwrite: true,
      });
      expect(result).toEqual(["/dst/a (copy).txt"]);
    });
  });

  describe("moveFiles", () => {
    it("calls move_files with source_paths and target_dir (snake_case)", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await fileCommands.moveFiles(["/src/a.txt", "/src/b.txt"], "/dst");
      expect(mockInvoke).toHaveBeenCalledWith("move_files", {
        source_paths: ["/src/a.txt", "/src/b.txt"],
        target_dir: "/dst",
      });
    });

    it("passes overwrite only when requested", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await fileCommands.moveFiles(["/src/a.txt"], "/dst/a.txt", true);
      expect(mockInvoke).toHaveBeenCalledWith("move_files", {
        source_paths: ["/src/a.txt"],
        target_dir: "/dst/a.txt",
        overwrite: true,
      });
    });
  });

  describe("checkCopyConflicts", () => {
    it("calls check_copy_conflicts with source_paths and target_path", async () => {
      mockInvoke.mockResolvedValue([]);
      await fileCommands.checkCopyConflicts(["/src/a.txt"], "/dst");
      expect(mockInvoke).toHaveBeenCalledWith("check_copy_conflicts", {
        source_paths: ["/src/a.txt"],
        target_path: "/dst",
      });
    });

    it("returns the resolved string[]", async () => {
      const conflicts = ["/dst/a.txt", "/dst/b.txt"];
      mockInvoke.mockResolvedValue(conflicts);
      const result = await fileCommands.checkCopyConflicts(["/src/a.txt", "/src/b.txt"], "/dst");
      expect(result).toEqual(conflicts);
    });
  });

  describe("renameFile", () => {
    it("calls rename_file with old_path and new_path", async () => {
      mockInvoke.mockResolvedValue(undefined);
      await fileCommands.renameFile("/dir/old.txt", "/dir/new.txt");
      expect(mockInvoke).toHaveBeenCalledWith("rename_file", {
        old_path: "/dir/old.txt",
        new_path: "/dir/new.txt",
      });
    });
  });

  describe("applyBatchRename", () => {
    it("calls apply_batch_rename with operations mapped to { old_path, new_path }", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const ops = [
        { oldPath: "/dir/a.txt", newPath: "/dir/alpha.txt" },
        { oldPath: "/dir/b.txt", newPath: "/dir/beta.txt" },
      ];
      await fileCommands.applyBatchRename(ops);
      expect(mockInvoke).toHaveBeenCalledWith("apply_batch_rename", {
        operations: [
          { old_path: "/dir/a.txt", new_path: "/dir/alpha.txt" },
          { old_path: "/dir/b.txt", new_path: "/dir/beta.txt" },
        ],
      });
    });
  });

  describe("readFileContent", () => {
    it("calls read_file_content and returns string", async () => {
      mockInvoke.mockResolvedValue("hello world");
      const result = await fileCommands.readFileContent("/some/file.txt");
      expect(mockInvoke).toHaveBeenCalledWith("read_file_content", { path: "/some/file.txt" });
      expect(result).toBe("hello world");
    });
  });

  describe("getDirSize", () => {
    it("calls get_dir_size and returns number", async () => {
      mockInvoke.mockResolvedValue(1024);
      const result = await fileCommands.getDirSize("/some/dir");
      expect(mockInvoke).toHaveBeenCalledWith("get_dir_size", { path: "/some/dir" });
      expect(result).toBe(1024);
    });
  });

  describe("estimateDirSize", () => {
    it("calls estimate_dir_size with limits and returns estimate metadata", async () => {
      mockInvoke.mockResolvedValue({
        size: 2048,
        isPartial: true,
        scannedEntries: 12,
      });

      const result = await fileCommands.estimateDirSize("/some/dir", {
        maxDepth: 1,
        maxEntries: 200,
      });

      expect(mockInvoke).toHaveBeenCalledWith("estimate_dir_size", {
        path: "/some/dir",
        max_depth: 1,
        max_entries: 200,
      });
      expect(result).toEqual({
        size: 2048,
        isPartial: true,
        scannedEntries: 12,
      });
    });
  });

  describe("scanDirSize", () => {
    it("calls scan_dir_size with scan id and returns scan metadata", async () => {
      mockInvoke.mockResolvedValue({
        size: 4096,
        isPartial: false,
        scannedEntries: 30,
        errorCount: 0,
      });

      const result = await fileCommands.scanDirSize("/some/dir", "scan-1");

      expect(mockInvoke).toHaveBeenCalledWith("scan_dir_size", {
        path: "/some/dir",
        scan_id: "scan-1",
      });
      expect(result).toEqual({
        size: 4096,
        isPartial: false,
        scannedEntries: 30,
        errorCount: 0,
      });
    });
  });

  describe("cancelDirSizeScan", () => {
    it("calls cancel_dir_size_scan with scan id", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await fileCommands.cancelDirSizeScan("scan-1");

      expect(mockInvoke).toHaveBeenCalledWith("cancel_dir_size_scan", {
        scan_id: "scan-1",
      });
    });
  });

  describe("loadDirSizeCache", () => {
    it("loads persisted directory size cache entries", async () => {
      mockInvoke.mockResolvedValue({
        version: 1,
        loadedAt: 123,
        entries: [
          {
            path: "/some/dir",
            size: 4096,
            status: "exact",
            scannedAt: 100,
            lastUsedAt: 120,
            isStale: false,
          },
        ],
      });

      const result = await fileCommands.loadDirSizeCache();

      expect(mockInvoke).toHaveBeenCalledWith("load_dir_size_cache");
      expect(result).toEqual([
        {
          path: "/some/dir",
          size: 4096,
          status: "exact",
          scannedAt: 100,
          lastUsedAt: 120,
          isStale: false,
        },
      ]);
    });
  });

  describe("upsertDirSizeCacheEntries", () => {
    it("persists stable directory size cache entries", async () => {
      mockInvoke.mockResolvedValue(undefined);
      const entries = [
        {
          path: "/some/dir",
          size: 4096,
          status: "partial" as const,
          scannedAt: 100,
          lastUsedAt: 120,
        },
      ];

      await fileCommands.upsertDirSizeCacheEntries(entries);

      expect(mockInvoke).toHaveBeenCalledWith("upsert_dir_size_cache_entries", {
        entries,
      });
    });
  });

  describe("deleteDirSizeCacheEntries", () => {
    it("deletes persisted directory size cache entries", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await fileCommands.deleteDirSizeCacheEntries(["/some/dir"]);

      expect(mockInvoke).toHaveBeenCalledWith("delete_dir_size_cache_entries", {
        paths: ["/some/dir"],
      });
    });
  });
});
