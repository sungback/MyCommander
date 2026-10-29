import { create } from "zustand";

export interface TransferSpaceShortage {
  isMove: boolean;
  /** 옮기는 데 필요한 크기. complete가 false면 하한값이다. */
  requiredBytes: number;
  availableBytes: number;
  complete: boolean;
}

interface PendingTransferSpaceWarning {
  shortage: TransferSpaceShortage;
  resolve: (proceed: boolean) => void;
}

interface TransferSpaceWarningState {
  pending: PendingTransferSpaceWarning | null;
  /** 경고를 띄우고 사용자가 계속하면 true, 취소하면 false로 끝나는 Promise를 돌려준다. */
  requestConfirmation: (shortage: TransferSpaceShortage) => Promise<boolean>;
  respond: (proceed: boolean) => void;
}

export const useTransferSpaceWarningStore = create<TransferSpaceWarningState>(
  (set, get) => ({
    pending: null,
    requestConfirmation: (shortage) =>
      new Promise<boolean>((resolve) => {
        // 이전 경고에 답하지 않은 채 새 요청이 오면 이전 작업은 취소로 끝낸다.
        get().pending?.resolve(false);
        set({ pending: { shortage, resolve } });
      }),
    respond: (proceed) => {
      const pending = get().pending;
      if (!pending) {
        return;
      }

      set({ pending: null });
      pending.resolve(proceed);
    },
  })
);
