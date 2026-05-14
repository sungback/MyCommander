import { describe, it, expect, vi, beforeEach } from "vitest";
import { systemCommands } from "./systemCommands";
import type { DriveInfo, ShowContextMenuRequest } from "./systemCommands";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

beforeEach(() => {
  mockInvoke.mockReset();
});

describe("systemCommands", () => {
  describe("getDrives", () => {
    it("calls invoke and returns drives", async () => {
      const drives: DriveInfo[] = [
        { mount_point: "/", name: "Macintosh HD", type: "disk", icon: "", isEjectable: false },
      ];
      mockInvoke.mockResolvedValue(drives);

      const result = await systemCommands.getDrives();

      expect(mockInvoke).toHaveBeenCalledWith("get_drives");
      expect(result).toEqual(drives);
    });

    it("returns [] when invoke throws", async () => {
      mockInvoke.mockRejectedValue(new Error("fail"));

      const result = await systemCommands.getDrives();

      expect(result).toEqual([]);
    });
  });

  describe("getHomeDir", () => {
    it("calls invoke and returns home dir", async () => {
      mockInvoke.mockResolvedValue("/Users/test");

      const result = await systemCommands.getHomeDir();

      expect(mockInvoke).toHaveBeenCalledWith("get_home_dir");
      expect(result).toBe("/Users/test");
    });

    it("returns '/' when invoke throws", async () => {
      mockInvoke.mockRejectedValue(new Error("fail"));

      const result = await systemCommands.getHomeDir();

      expect(result).toBe("/");
    });
  });

  describe("resolvePath", () => {
    it("calls invoke with correct args and returns result", async () => {
      mockInvoke.mockResolvedValue("/resolved/path");

      const result = await systemCommands.resolvePath("/some/path");

      expect(mockInvoke).toHaveBeenCalledWith("resolve_path", { path: "/some/path" });
      expect(result).toBe("/resolved/path");
    });
  });

  describe("getAvailableSpace", () => {
    it("returns null when invoke throws", async () => {
      mockInvoke.mockRejectedValue(new Error("fail"));

      const result = await systemCommands.getAvailableSpace("/some/path");

      expect(result).toBeNull();
    });

    it("returns space value on success", async () => {
      mockInvoke.mockResolvedValue(1024);

      const result = await systemCommands.getAvailableSpace("/some/path");

      expect(mockInvoke).toHaveBeenCalledWith("get_available_space", { path: "/some/path" });
      expect(result).toBe(1024);
    });
  });

  describe("openInTerminal", () => {
    it("calls invoke with path", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await systemCommands.openInTerminal("/some/path");

      expect(mockInvoke).toHaveBeenCalledWith("open_in_terminal", { path: "/some/path" });
    });
  });

  describe("openFile", () => {
    it("calls invoke with path", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await systemCommands.openFile("/some/file.txt");

      expect(mockInvoke).toHaveBeenCalledWith("open_file", { path: "/some/file.txt" });
    });
  });

  describe("quitApp", () => {
    it("calls invoke quit_app", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await systemCommands.quitApp();

      expect(mockInvoke).toHaveBeenCalledWith("quit_app");
    });
  });

  describe("writeFilesToPasteboard", () => {
    it("calls invoke with paths and operation", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await systemCommands.writeFilesToPasteboard(["a", "b"], "copy");

      expect(mockInvoke).toHaveBeenCalledWith("write_files_to_pasteboard", {
        paths: ["a", "b"],
        operation: "copy",
      });
    });
  });

  describe("setShowHiddenMenuChecked", () => {
    it("calls invoke with checked flag", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await systemCommands.setShowHiddenMenuChecked(true);

      expect(mockInvoke).toHaveBeenCalledWith("set_show_hidden_menu_checked", { checked: true });
    });
  });

  describe("showContextMenu", () => {
    it("calls invoke with snake_case request fields", async () => {
      mockInvoke.mockResolvedValue(undefined);

      const request: ShowContextMenuRequest = {
        x: 100,
        y: 200,
        hasTargetItem: true,
        canRename: false,
        canNormalizeFilename: true,
        canCalculateSize: true,
        isCalculatingSize: false,
        canCreateZip: false,
        canExtractZip: true,
      };

      await systemCommands.showContextMenu(request);

      expect(mockInvoke).toHaveBeenCalledWith("show_context_menu", {
        request: {
          x: 100,
          y: 200,
          has_target_item: true,
          can_rename: false,
          can_normalize_filename: true,
          can_calculate_size: true,
          is_calculating_size: false,
          can_create_zip: false,
          can_extract_zip: true,
        },
      });
    });
  });
});
