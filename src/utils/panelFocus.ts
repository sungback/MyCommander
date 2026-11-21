import { usePanelStore } from "../store/panelStore";

// 대화상자를 닫은 뒤 활성 패널의 파일 목록으로 포커스를 돌려 방향키가 바로 동작하게 한다.
// 다른 대화상자가 이어서 열려 있으면(예: 복사 대화상자 뒤의 진행 대화상자) 포커스를 빼앗지 않는다.
export const focusActivePanelList = () => {
  if (document.querySelector('[role="dialog"]')) {
    return;
  }
  const panelId = usePanelStore.getState().activePanel;
  document
    .querySelector<HTMLElement>(`[role="listbox"][data-panel-id="${panelId}"]`)
    ?.focus({ preventScroll: true });
};
