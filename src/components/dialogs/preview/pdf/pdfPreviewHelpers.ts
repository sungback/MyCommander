import type { PdfPageSize } from "./pdfTypes";

/**
 * 키 입력에 따른 다음 페이지 번호. 처리하지 않는 키면 null.
 * 아래/오른쪽/PageDown은 다음 장, 위/왼쪽/PageUp은 이전 장, Home/End는 처음/끝이다.
 */
export const getPdfPageForKey = (
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
export const getFitScale = (page: PdfPageSize, areaWidth: number, areaHeight: number) => {
  if (page.width <= 0 || page.height <= 0 || areaWidth <= 0 || areaHeight <= 0) {
    return 1;
  }

  return Math.min(areaWidth / page.width, areaHeight / page.height);
};

export interface RenderLimiter {
  /** 동시에 실행하는 작업 수를 제한해 `job`을 실행한다. 실행 전에 `isCancelled`가 true가 되면 건너뛴다. */
  run: (job: () => Promise<void>, isCancelled: () => boolean) => Promise<void>;
}

/** 썸네일처럼 한꺼번에 많이 요청되는 렌더링의 동시 실행 수를 제한한다. */
export const createRenderLimiter = (limit: number): RenderLimiter => {
  let active = 0;
  const waiting: Array<() => void> = [];

  const release = () => {
    active -= 1;
    waiting.shift()?.();
  };

  return {
    run: async (job, isCancelled) => {
      if (active >= limit) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      active += 1;

      try {
        if (!isCancelled()) {
          await job();
        }
      } finally {
        release();
      }
    },
  };
};

/** pdf.js 오류 중 암호가 필요한 문서인지 판별한다. */
export const isPdfPasswordError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: unknown }).name === "PasswordException";

/** 페이지를 넘기다 취소된 렌더링 오류는 무시한다. */
export const isPdfRenderCancelled = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: unknown }).name === "RenderingCancelledException";
