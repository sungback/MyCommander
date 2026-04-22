import React from "react";
import { X } from "lucide-react";
import { ToastItem, useToastStore } from "../../store/toastStore";

const toneClasses = (tone: ToastItem["tone"]) => {
  switch (tone) {
    case "success":
      return "border-emerald-400/40 bg-emerald-500/12 text-emerald-100";
    case "warning":
      return "border-amber-400/40 bg-amber-500/12 text-amber-100";
    case "error":
      return "border-red-400/40 bg-red-500/12 text-red-100";
    case "info":
    default:
      return "border-border-color bg-bg-panel text-text-primary";
  }
};

export const ToastViewport: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] flex max-w-[min(92vw,360px)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-3 py-2 text-sm shadow-xl backdrop-blur-sm ${toneClasses(
            toast.tone
          )}`}
        >
          <p className="min-w-0 flex-1 break-words">{toast.message}</p>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 rounded p-0.5 text-current/70 transition-colors hover:text-current"
            aria-label="Dismiss toast"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
