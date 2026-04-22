import { create } from "zustand";

export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: ToastItem[];
  pushToast: (toast: Omit<ToastItem, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

let toastSequence = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: ({ message, tone }) => {
    const id = `toast-${Date.now()}-${toastSequence++}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, tone }],
    }));
    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

export const showTransientToast = (
  message: string,
  options: { durationMs?: number; tone?: ToastTone } = {}
) => {
  const durationMs = options.durationMs ?? 1400;
  const tone = options.tone ?? "info";
  const id = useToastStore.getState().pushToast({ message, tone });

  globalThis.setTimeout(() => {
    useToastStore.getState().removeToast(id);
  }, durationMs);
};
