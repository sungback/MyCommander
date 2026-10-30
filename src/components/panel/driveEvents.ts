const DRIVES_CHANGED_EVENT = "mycommander:drives-changed";

/** 디스크 이미지를 마운트하거나 드라이브를 추출한 뒤 드라이브 목록 갱신을 요청한다. */
export const notifyDrivesChanged = () => {
  window.dispatchEvent(new Event(DRIVES_CHANGED_EVENT));
};

/** 드라이브 목록 갱신 요청을 구독하고 해제 함수를 반환한다. */
export const onDrivesChanged = (listener: () => void) => {
  window.addEventListener(DRIVES_CHANGED_EVENT, listener);
  return () => window.removeEventListener(DRIVES_CHANGED_EVENT, listener);
};
