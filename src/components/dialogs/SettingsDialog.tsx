import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { useDialogStore } from "../../store/dialogStore";
import { useSettingsStore } from "../../store/settingsStore";
import { Settings } from "lucide-react";

const WINDOW_PRESETS = [
  "800x600",
  "1024x768",
  "1280x800",
  "1440x900",
  "1920x1080"
];

export const SettingsDialog: React.FC = () => {
  const { openDialog, closeDialog } = useDialogStore();
  const settings = useSettingsStore();

  const [fontSize, setFontSize] = useState(settings.fontSize.toString());
  const [panelLeftRatio, setPanelLeftRatio] = useState(settings.panelLeftRatio.toString());
  const [selectedPreset, setSelectedPreset] = useState("");

  const isOpen = openDialog === "settings";

  useEffect(() => {
    if (isOpen) {
      setFontSize(settings.fontSize.toString());
      setPanelLeftRatio(settings.panelLeftRatio.toString());
      setSelectedPreset(""); // reset preset selection on open
    }
  }, [isOpen, settings]);

  const handleSave = async () => {
    const parsedFontSize = parseInt(fontSize, 10);
    const parsedRatio = parseInt(panelLeftRatio, 10);

    if (!isNaN(parsedFontSize) && parsedFontSize >= 10 && parsedFontSize <= 40) {
      settings.setFontSize(parsedFontSize);
    }
    
    if (!isNaN(parsedRatio) && parsedRatio >= 10 && parsedRatio <= 90) {
      settings.setPanelLeftRatio(parsedRatio);
    }

    if (selectedPreset) {
      const [w, h] = selectedPreset.split("x").map(Number);
      if (w && h) {
        try {
          await getCurrentWindow().setSize(new LogicalSize(w, h));
        } catch (e) {
          console.error("Failed to set window size", e);
        }
      }
    }

    closeDialog();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-bg-panel border border-border-color rounded shadow-xl w-[420px] z-50 p-5 focus:outline-none text-text-primary">
          <div className="flex items-center gap-2 border-b border-border-color pb-3 mb-5">
            <Settings size={18} className="text-accent-color" />
            <Dialog.Title className="text-lg font-bold">Preferences</Dialog.Title>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Font Size (px)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="40"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  className="w-24 bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected"
                />
                <span className="text-xs text-text-secondary">Default: 14px</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Left Panel Width (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="90"
                  value={panelLeftRatio}
                  onChange={(e) => setPanelLeftRatio(e.target.value)}
                  className="w-24 bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color selection:bg-bg-selected"
                />
                <span className="text-xs text-text-secondary">Default: 50%</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Window Size Preset</label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="w-full bg-bg-primary border border-border-color rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent-color"
              >
                <option value="">Keep Current Size</option>
                {WINDOW_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-text-secondary mt-1">
                * Window dimensions are remembered automatically when you resize manually.
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-2">
            <button
              onClick={closeDialog}
              className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-secondary hover:bg-bg-hover rounded border border-border-color focus:outline-none focus:ring-1 focus:ring-accent-color transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 min-w-[80px] text-sm bg-bg-selected hover:opacity-90 rounded border border-transparent focus:outline-none focus:ring-1 focus:ring-white transition-opacity"
            >
              Save
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
