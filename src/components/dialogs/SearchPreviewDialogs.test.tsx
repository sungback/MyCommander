import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  emitSearchEvents,
  mockCheckCopyConflicts,
  mockCopyFiles,
  mockDeleteFiles,
  mockMoveFiles,
  mockRefreshPanelsForDirectories,
  mockRefreshPanelsForEntryPaths,
  mockSearchFiles,
  registerSearchPreviewDialogsTestLifecycle,
} from './SearchPreviewDialogs.test-harness';
import { SearchPreviewDialogs } from './SearchPreviewDialogs';
import { usePanelStore } from '../../store/panelStore';
import type { SearchEvent } from './SearchPreviewDialogs.test-harness';

describe('SearchPreviewDialogs', () => {
  registerSearchPreviewDialogsTestLifecycle();

  it("passes advanced search options to searchFiles", async () => {
    render(<SearchPreviewDialogs />);

    fireEvent.change(screen.getByPlaceholderText("Find files..."), {
      target: { value: "report" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));

    fireEvent.click(screen.getByLabelText("Case sensitive"));
    fireEvent.click(screen.getByLabelText("Include hidden files"));
    fireEvent.change(screen.getByLabelText("Entry kind"), {
      target: { value: "files" },
    });
    fireEvent.change(screen.getByLabelText("Scope"), {
      target: { value: "path" },
    });
    fireEvent.change(screen.getByLabelText("Extensions"), {
      target: { value: ".md, txt" },
    });
    fireEvent.change(screen.getByLabelText("Min size (bytes)"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Max size (bytes)"), {
      target: { value: "4096" },
    });
    fireEvent.change(screen.getByLabelText("Modified after"), {
      target: { value: "2026-04-01" },
    });
    fireEvent.change(screen.getByLabelText("Modified before"), {
      target: { value: "2026-04-22" },
    });
    fireEvent.change(screen.getByLabelText("Max results"), {
      target: { value: "250" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(mockSearchFiles).toHaveBeenCalledTimes(1);
    });

    const [, options] = mockSearchFiles.mock.calls[0];
    expect(options).toMatchObject({
      query: "report",
      useRegex: false,
      caseSensitive: false,
      includeHidden: false,
      scope: "path",
      entryKind: "files",
      extensions: ["md", "txt"],
      minSizeBytes: 100,
      maxSizeBytes: 4096,
      maxResults: 250,
    });
    expect((options as { modifiedAfterMs: number | null }).modifiedAfterMs).not.toBeNull();
    expect((options as { modifiedBeforeMs: number | null }).modifiedBeforeMs).not.toBeNull();
  });

  it("renders results returned from the search event stream", async () => {
    mockSearchFiles.mockImplementation(
      async (
        _startPath: string,
        _options: unknown,
        onEvent: (event: SearchEvent) => void
      ) => {
        emitSearchEvents(onEvent, [
          { name: "notes.txt", path: "/home/user/notes.txt", size: 1024, is_dir: false },
        ]);
      }
    );

    render(<SearchPreviewDialogs />);

    fireEvent.change(screen.getByPlaceholderText("Find files..."), {
      target: { value: "notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("/home/user/notes.txt")).toBeInTheDocument();
    });
  });

  it("copies selected search results using the target panel path", async () => {
    mockSearchFiles.mockImplementation(
      async (
        _startPath: string,
        _options: unknown,
        onEvent: (event: SearchEvent) => void
      ) => {
        emitSearchEvents(onEvent, [
          { name: "notes.txt", path: "/home/user/notes.txt", size: 1024, is_dir: false },
        ]);
      }
    );

    render(<SearchPreviewDialogs />);

    fireEvent.change(screen.getByPlaceholderText("Find files..."), {
      target: { value: "notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("/home/user/notes.txt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Copy Selected" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("/target")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ["/home/user/notes.txt"],
        "/target"
      );
      expect(mockCopyFiles).toHaveBeenCalledWith(["/home/user/notes.txt"], "/target");
    });
  });

  it("does not copy selected search results when the target has conflicts", async () => {
    mockCheckCopyConflicts.mockResolvedValue(["notes.txt"]);
    mockSearchFiles.mockImplementation(
      async (
        _startPath: string,
        _options: unknown,
        onEvent: (event: SearchEvent) => void
      ) => {
        emitSearchEvents(onEvent, [
          { name: "notes.txt", path: "/home/user/notes.txt", size: 1024, is_dir: false },
        ]);
      }
    );

    render(<SearchPreviewDialogs />);

    fireEvent.change(screen.getByPlaceholderText("Find files..."), {
      target: { value: "notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("/home/user/notes.txt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Copy Selected" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("/target")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(
        screen.getByText("Copy target has conflicting item name(s): notes.txt")
      ).toBeInTheDocument();
    });
    expect(mockCopyFiles).not.toHaveBeenCalled();
  });

  it("moves selected search results using the target panel path", async () => {
    mockSearchFiles.mockImplementation(
      async (
        _startPath: string,
        _options: unknown,
        onEvent: (event: SearchEvent) => void
      ) => {
        emitSearchEvents(onEvent, [
          { name: "notes.txt", path: "/home/user/notes.txt", size: 1024, is_dir: false },
        ]);
      }
    );

    render(<SearchPreviewDialogs />);

    fireEvent.change(screen.getByPlaceholderText("Find files..."), {
      target: { value: "notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("/home/user/notes.txt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Move Selected" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("/target")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => {
      expect(mockMoveFiles).toHaveBeenCalledWith(["/home/user/notes.txt"], "/target");
    });
    expect(screen.queryByText("/home/user/notes.txt")).not.toBeInTheDocument();
    expect(mockRefreshPanelsForDirectories).toHaveBeenCalledWith([
      "/target",
      "/home/user",
    ]);
  });

  it("deletes selected search results after collapsing descendants under selected directories", async () => {
    mockSearchFiles.mockImplementation(
      async (
        _startPath: string,
        _options: unknown,
        onEvent: (event: SearchEvent) => void
      ) => {
        emitSearchEvents(onEvent, [
          { name: "docs", path: "/home/user/docs", is_dir: true },
          { name: "nested.txt", path: "/home/user/docs/nested.txt", size: 12, is_dir: false },
          { name: "root.txt", path: "/home/user/root.txt", size: 24, is_dir: false },
        ]);
      }
    );

    render(<SearchPreviewDialogs />);

    fireEvent.change(screen.getByPlaceholderText("Find files..."), {
      target: { value: "txt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("/home/user/docs/nested.txt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Select All" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Selected" }));

    await waitFor(() => {
      expect(mockDeleteFiles).toHaveBeenCalledWith(
        ["/home/user/docs", "/home/user/root.txt"],
        false
      );
    });
    expect(screen.queryByText("/home/user/docs/nested.txt")).not.toBeInTheDocument();
    expect(mockRefreshPanelsForEntryPaths).toHaveBeenCalledWith([
      "/home/user/docs",
      "/home/user/root.txt",
    ]);
  });

  it("resolves relative copy targets against the target panel access path", async () => {
    usePanelStore.setState((state) => ({
      ...state,
      rightPanel: {
        ...state.rightPanel,
        currentPath: "/Users/back/Dropbox",
        resolvedPath: "/Users/back/Library/CloudStorage/Dropbox",
      },
    }));
    mockSearchFiles.mockImplementation(
      async (
        _startPath: string,
        _options: unknown,
        onEvent: (event: SearchEvent) => void
      ) => {
        emitSearchEvents(onEvent, [
          { name: "notes.txt", path: "/home/user/notes.txt", size: 1024, is_dir: false },
        ]);
      }
    );

    render(<SearchPreviewDialogs />);

    fireEvent.change(screen.getByPlaceholderText("Find files..."), {
      target: { value: "notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("/home/user/notes.txt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Copy Selected" }));

    const targetInput = await screen.findByDisplayValue("/Users/back/Dropbox");
    fireEvent.change(targetInput, { target: { value: "Archive" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(mockCheckCopyConflicts).toHaveBeenCalledWith(
        ["/home/user/notes.txt"],
        "/Users/back/Library/CloudStorage/Dropbox/Archive"
      );
      expect(mockCopyFiles).toHaveBeenCalledWith(
        ["/home/user/notes.txt"],
        "/Users/back/Library/CloudStorage/Dropbox/Archive"
      );
    });
  });

  it("keeps the operation dialog open and shows an error when move fails", async () => {
    mockMoveFiles.mockRejectedValue(new Error("move failed"));
    mockSearchFiles.mockImplementation(
      async (
        _startPath: string,
        _options: unknown,
        onEvent: (event: SearchEvent) => void
      ) => {
        emitSearchEvents(onEvent, [
          { name: "notes.txt", path: "/home/user/notes.txt", size: 1024, is_dir: false },
        ]);
      }
    );

    render(<SearchPreviewDialogs />);

    fireEvent.change(screen.getByPlaceholderText("Find files..."), {
      target: { value: "notes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("/home/user/notes.txt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Move Selected" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("/target")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => {
      expect(screen.getByText("move failed")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("/target")).toBeInTheDocument();
  });
});
