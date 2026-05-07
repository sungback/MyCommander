import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDialogStore } from "../../store/dialogStore";
import { usePanelStore } from "../../store/panelStore";
import { useFileSystem } from "../../hooks/useFileSystem";
import type { SyncDirection } from "../../types/sync";
import { Loader2 } from "lucide-react";
import {
  getStatusColor,
  getStatusLabel,
} from "./syncDialogHelpers";
import { useSyncDialogState } from "./useSyncDialogState";

export const SyncDialog: React.FC = () => {
  const { openDialog, closeDialog } = useDialogStore();
  const fs = useFileSystem();
  const leftPanel = usePanelStore((s) => s.leftPanel);
  const rightPanel = usePanelStore((s) => s.rightPanel);
  const showHiddenFiles = usePanelStore((s) => s.showHiddenFiles);
  const refreshPanel = usePanelStore((s) => s.refreshPanel);

  const {
    stage,
    leftPath,
    setLeftPath,
    rightPath,
    setRightPath,
    syncItems,
    error,
    executing,
    executionProgress,
    handleStartAnalysis,
    handleUpdateDirection,
    handleSelectAll,
    handleExcludeSame,
    handleExecuteSync,
    handleBack,
  } = useSyncDialogState({
    openDialog,
    leftPanel,
    rightPanel,
    showHiddenFiles,
    fs,
    refreshPanel,
    closeDialog,
  });

  return (
    <Dialog.Root open={openDialog === "sync"} onOpenChange={(open) => !open && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[700px] max-h-[80vh] z-50 p-4 focus:outline-none text-text-primary flex flex-col">
          <Dialog.Title className="text-sm font-bold border-b border-border-color pb-2 mb-4">
            Folder Synchronization
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Compare two folders and synchronize the selected differences.
          </Dialog.Description>

          <div className="flex-1 overflow-y-auto mb-4">
            {/* Stage: Paths */}
            {stage === "paths" && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-text-secondary block mb-2">Left Directory</label>
                  <input
                    type="text"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={leftPath}
                    onChange={(e) => setLeftPath(e.target.value)}
                    className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary block mb-2">Right Directory</label>
                  <input
                    type="text"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={rightPath}
                    onChange={(e) => setRightPath(e.target.value)}
                    className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
              </div>
            )}

            {/* Stage: Analyzing */}
            {stage === "analyzing" && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent-color mb-4" />
                <p className="text-sm text-text-secondary">Comparing directories...</p>
              </div>
            )}

            {/* Stage: Results */}
            {stage === "results" && (
              <div className="space-y-4">
                <div className="text-xs text-text-secondary">
                  Found {syncItems.length} item(s) to compare
                </div>

                {/* Control buttons */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleSelectAll("toRight")}
                    className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color transition-colors"
                  >
                    All →
                  </button>
                  <button
                    onClick={() => handleSelectAll("toLeft")}
                    className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color transition-colors"
                  >
                    All ←
                  </button>
                  <button
                    onClick={handleExcludeSame}
                    className="px-3 py-1 text-xs bg-bg-secondary hover:bg-bg-hover rounded border border-border-color transition-colors"
                  >
                    Exclude Same
                  </button>
                </div>

                {/* Results table */}
                <div className="border border-border-color rounded overflow-hidden">
                  <div className="grid grid-cols-4 gap-0 bg-bg-secondary border-b border-border-color text-xs font-semibold sticky top-0">
                    <div className="px-2 py-1.5">File</div>
                    <div className="px-2 py-1.5">Status</div>
                    <div className="px-2 py-1.5 col-span-2">Direction</div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {syncItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-4 gap-0 border-b border-border-color text-xs hover:bg-bg-hover transition-colors"
                      >
                        <div className="px-2 py-1.5 truncate" title={item.relPath}>
                          {item.relPath}
                        </div>
                        <div className={`px-2 py-1.5 ${getStatusColor(item.status)}`}>
                          {getStatusLabel(item.status)}
                        </div>
                        <div className="px-2 py-1.5 col-span-2">
                          {item.status === "Same" ? (
                            <span className="text-text-secondary">skip</span>
                          ) : (
                            <select
                              value={item.direction}
                              onChange={(e) =>
                                handleUpdateDirection(
                                  idx,
                                  e.target.value as SyncDirection
                                )
                              }
                              className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-accent-color"
                            >
                              <option value="skip">skip</option>
                              <option value="toRight">→</option>
                              <option value="toLeft">←</option>
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {error && <p className="text-xs text-red-400">{error}</p>}
              </div>
            )}

            {/* Stage: Executing */}
            {stage === "executing" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Loader2 className="w-4 h-4 animate-spin text-accent-color" />
                  <span className="text-sm text-text-secondary">
                    Synchronizing: {executionProgress.done}/{executionProgress.total}
                  </span>
                </div>
                <div className="w-full bg-bg-secondary rounded h-2 overflow-hidden">
                  <div
                    className="bg-accent-color h-full transition-all"
                    style={{
                      width: `${
                        executionProgress.total > 0
                          ? (executionProgress.done / executionProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="border-t border-border-color pt-4 flex justify-end gap-2">
            {stage === "paths" && (
              <>
                <button
                  onClick={closeDialog}
                  className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartAnalysis}
                  className="px-4 py-1.5 min-w-[100px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity"
                >
                  Analyze
                </button>
              </>
            )}

            {stage === "results" && (
              <>
                <button
                  onClick={handleBack}
                  className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={closeDialog}
                  className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteSync}
                  disabled={executing}
                  className="px-4 py-1.5 min-w-[100px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {executing ? "Syncing..." : "Synchronize"}
                </button>
              </>
            )}

            {stage === "executing" && (
              <button
                disabled
                className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary rounded border border-border-color opacity-60 cursor-not-allowed"
              >
                Processing...
              </button>
            )}

            {stage === "analyzing" && (
              <button
                disabled
                className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary rounded border border-border-color opacity-60 cursor-not-allowed"
              >
                Analyzing...
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
