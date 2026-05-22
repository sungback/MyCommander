import { describe, expect, it } from "vitest";
import { getPreviewStatusContent } from "./quickPreviewStatus";

describe("getPreviewStatusContent", () => {
  it("returns a Korean loading message", () => {
    expect(getPreviewStatusContent({ type: "loading" })).toEqual({
      kind: "loading",
      title: "미리보기를 준비 중입니다",
      description: "파일 내용을 불러오고 있습니다.",
    });
  });

  it("returns a consistent unsupported-file message", () => {
    expect(getPreviewStatusContent({ type: "unsupported" })).toEqual({
      kind: "unsupported",
      title: "미리보기를 지원하지 않는 형식입니다",
      description: "이 파일 형식은 빠른 미리보기에서 바로 열 수 없습니다.",
    });
  });

  it("turns the file-size error into a user-facing size message", () => {
    expect(
      getPreviewStatusContent({
        type: "error",
        error: "파일이 너무 큽니다 (5MB 초과). 미리보기를 지원하지 않습니다.",
      })
    ).toEqual({
      kind: "too-large",
      title: "파일이 너무 큽니다",
      description: "5MB를 초과한 파일은 빠른 미리보기에서 열지 않습니다.",
      detail: "파일이 너무 큽니다 (5MB 초과). 미리보기를 지원하지 않습니다.",
    });
  });

  it("keeps unexpected load errors as technical detail", () => {
    expect(
      getPreviewStatusContent({
        type: "error",
        error: "Renderer crashed",
      })
    ).toEqual({
      kind: "error",
      title: "미리보기를 불러오지 못했습니다",
      description: "파일을 읽거나 렌더링하는 중 문제가 발생했습니다.",
      detail: "Renderer crashed",
    });
  });
});
