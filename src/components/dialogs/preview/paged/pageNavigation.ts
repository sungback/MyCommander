/**
 * 키 입력에 따른 다음 페이지 번호. 처리하지 않는 키면 null.
 * 아래/오른쪽/PageDown은 다음 장, 위/왼쪽/PageUp은 이전 장, Home/End는 처음/끝이다.
 */
export const getPageForKey = (
  key: string,
  currentPage: number,
  pageCount: number
): number | null => {
  if (pageCount < 1) {
    return null;
  }

  const clamp = (page: number) => Math.min(Math.max(page, 1), pageCount);
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
    case "PageDown":
      return clamp(currentPage + 1);
    case "ArrowUp":
    case "ArrowLeft":
    case "PageUp":
      return clamp(currentPage - 1);
    case "Home":
      return 1;
    case "End":
      return pageCount;
    default:
      return null;
  }
};

/** 페이지 전체가 영역 안에 들어가는 배율(화면 배율 제외). */
export const getFitScale = (
  page: { width: number; height: number },
  areaWidth: number,
  areaHeight: number
) => {
  if (page.width <= 0 || page.height <= 0 || areaWidth <= 0 || areaHeight <= 0) {
    return 1;
  }

  return Math.min(areaWidth / page.width, areaHeight / page.height);
};
