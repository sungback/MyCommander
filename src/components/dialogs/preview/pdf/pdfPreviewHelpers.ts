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
