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
  type SearchEvent,
} from './SearchPreviewDialogs.test-harness';
import { SearchPreviewDialogs } from './SearchPreviewDialogs';
import { usePanelStore } from '../../../store/panelStore';

const notesResult = {
  name: "notes.txt",
  path: "/home/user/notes.txt",
  size: 1024,
  is_dir: false,
};

type SearchResults = NonNullable<Parameters<typeof emitSearchEvents>[1]>;

const renderSearchResults = async (
  results: SearchResults,
  visiblePath: string
) => {
  mockSearchFiles.mockImplementation(
    async (
      _startPath: string,
      _options: unknown,
      onEvent: (event: SearchEvent) => void
    ) => {
      emitSearchEvents(onEvent, results);
    }
  );

  render(<SearchPreviewDialogs />);
  fireEvent.change(screen.getByPlaceholderText("Find files..."), {
    target: { value: "notes" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  await waitFor(() => {
    expect(screen.getByText(visiblePath)).toBeInTheDocument();
  });
};

const chooseFirstResult = () => {
  fireEvent.click(screen.getByRole("checkbox"));
};

describe('SearchPreviewDialogs operations', () => {
  registerSearchPreviewDialogsTestLifecycle();

  it("copies selected search results using the target panel path", async () => {
    await renderSearchResults([notesResult], "/home/user/notes.txt");
    chooseFirstResult();
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
    await renderSearchResults([notesResult], "/home/user/notes.txt");
    chooseFirstResult();
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
    await renderSearchResults([notesResult], "/home/user/notes.txt");
    chooseFirstResult();
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
    await renderSearchResults(
      [
        { name: "docs", path: "/home/user/docs", is_dir: true },
        { name: "nested.txt", path: "/home/user/docs/nested.txt", size: 12, is_dir: false },
        { name: "root.txt", path: "/home/user/root.txt", size: 24, is_dir: false },
      ],
      "/home/user/docs/nested.txt"
    );

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

    await renderSearchResults([notesResult], "/home/user/notes.txt");
    chooseFirstResult();
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
    await renderSearchResults([notesResult], "/home/user/notes.txt");
    chooseFirstResult();
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
