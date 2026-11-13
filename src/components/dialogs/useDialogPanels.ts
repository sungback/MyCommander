import { useRef, useSyncExternalStore } from "react";
import { usePanelStore } from "../../store/panelStore";
import type { PanelState } from "../../types/file";

interface DialogPanels {
  leftPanel: PanelState;
  rightPanel: PanelState;
}

/**
 * 두 패널 상태를 구독하되, 대화상자가 모두 닫힌 동안(`isIdle`)에는 마지막 값을 유지합니다.
 * 닫힌 동안은 패널 값을 읽는 곳이 없으므로 커서 이동 같은 패널 변경으로 재렌더되지 않게 하고,
 * 대화상자가 열리는 렌더에서는 최신 값을 읽습니다.
 */
export const useDialogPanels = (isIdle: boolean): DialogPanels => {
  const cacheRef = useRef<DialogPanels | null>(null);

  const getSnapshot = (): DialogPanels => {
    const cached = cacheRef.current;
    if (isIdle && cached) {
      return cached;
    }

    const { leftPanel, rightPanel } = usePanelStore.getState();
    if (
      cached &&
      cached.leftPanel === leftPanel &&
      cached.rightPanel === rightPanel
    ) {
      return cached;
    }

    const next = { leftPanel, rightPanel };
    cacheRef.current = next;
    return next;
  };

  return useSyncExternalStore(usePanelStore.subscribe, getSnapshot);
};
