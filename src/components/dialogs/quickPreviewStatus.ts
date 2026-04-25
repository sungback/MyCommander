import type { PreviewState } from "./quickPreviewLoader";

export type PreviewStatusKind = "loading" | "unsupported" | "too-large" | "error";

export interface PreviewStatusContent {
  kind: PreviewStatusKind;
  title: string;
  description: string;
  detail?: string;
}

const isFileTooLargeError = (error: string | undefined) =>
  Boolean(error && (error.includes("파일이 너무 큽니다") || error.includes("5MB")));

export const getPreviewStatusContent = (
  preview: Pick<PreviewState, "type" | "error">
): PreviewStatusContent | null => {
  if (preview.type === "loading") {
    return {
      kind: "loading",
      title: "미리보기를 준비 중입니다",
      description: "파일 내용을 불러오고 있습니다.",
    };
  }

  if (preview.type === "unsupported") {
    return {
      kind: "unsupported",
      title: "미리보기를 지원하지 않는 형식입니다",
      description: "이 파일 형식은 빠른 미리보기에서 바로 열 수 없습니다.",
    };
  }

  if (preview.type === "error") {
    if (isFileTooLargeError(preview.error)) {
      return {
        kind: "too-large",
        title: "파일이 너무 큽니다",
        description: "5MB를 초과한 파일은 빠른 미리보기에서 열지 않습니다.",
        detail: preview.error,
      };
    }

    return {
      kind: "error",
      title: "미리보기를 불러오지 못했습니다",
      description: "파일을 읽거나 렌더링하는 중 문제가 발생했습니다.",
      detail: preview.error,
    };
  }

  return null;
};
