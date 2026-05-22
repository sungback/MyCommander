import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  emitSearchEvents,
  mockSearchFiles,
  registerSearchPreviewDialogsTestLifecycle,
} from './SearchPreviewDialogs.test-harness';
import { SearchPreviewDialogs } from './SearchPreviewDialogs';
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

});
