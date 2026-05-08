import { describe, expect, it } from "vitest";
import { buildSyncExecutionOperations } from "./syncExecution";
import type { SyncItem } from "../types/sync";

const LEFT = "/left";
const RIGHT = "/right";

const item = (overrides: Partial<SyncItem>): SyncItem => {
  const relPath = overrides.relPath ?? "file.txt";
  return {
    relPath,
    leftPath: `${LEFT}/${relPath}`,
    rightPath: `${RIGHT}/${relPath}`,
    leftKind: "file",
    rightKind: "file",
    status: "LeftNewer",
    direction: "toRight",
    ...overrides,
  };
};

describe("buildSyncExecutionOperations", () => {
  it("skip 방향 항목은 제외된다", () => {
    const result = buildSyncExecutionOperations(
      [item({ direction: "skip" })],
      LEFT,
      RIGHT
    );
    expect(result).toHaveLength(0);
  });

  it("toRight 파일 항목이 올바른 targetPath를 갖는다", () => {
    const result = buildSyncExecutionOperations(
      [item({ direction: "toRight", relPath: "a.txt" })],
      LEFT,
      RIGHT
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      direction: "toRight",
      sourcePath: `${LEFT}/a.txt`,
      targetPath: `${RIGHT}/a.txt`,
      sourceKind: "file",
    });
  });

  it("toLeft 파일 항목은 leftRoot를 targetPath로 사용한다", () => {
    const result = buildSyncExecutionOperations(
      [
        item({
          direction: "toLeft",
          relPath: "b.txt",
          leftPath: `${LEFT}/b.txt`,
          rightPath: `${RIGHT}/b.txt`,
          leftKind: "file",
          rightKind: "file",
          status: "RightNewer",
        }),
      ],
      LEFT,
      RIGHT
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      direction: "toLeft",
      sourcePath: `${RIGHT}/b.txt`,
      targetPath: `${LEFT}/b.txt`,
    });
  });

  it("sourcePath 또는 sourceKind가 없으면 제외된다", () => {
    const result = buildSyncExecutionOperations(
      [item({ direction: "toRight", leftPath: null, leftKind: null })],
      LEFT,
      RIGHT
    );
    expect(result).toHaveLength(0);
  });

  it("LeftOnly 디렉터리는 포함된다", () => {
    const result = buildSyncExecutionOperations(
      [
        item({
          relPath: "docs",
          direction: "toRight",
          leftKind: "directory",
          rightKind: null,
          rightPath: null,
          status: "LeftOnly",
        }),
      ],
      LEFT,
      RIGHT
    );
    expect(result).toHaveLength(1);
    expect(result[0].sourceKind).toBe("directory");
  });

  it("Same 디렉터리는 제외된다", () => {
    const result = buildSyncExecutionOperations(
      [
        item({
          relPath: "docs",
          direction: "toRight",
          leftKind: "directory",
          status: "Same",
        }),
      ],
      LEFT,
      RIGHT
    );
    expect(result).toHaveLength(0);
  });

  it("부모 디렉터리가 있으면 하위 파일은 제외된다", () => {
    const result = buildSyncExecutionOperations(
      [
        item({
          relPath: "docs",
          direction: "toRight",
          leftKind: "directory",
          rightKind: null,
          rightPath: null,
          status: "LeftOnly",
        }),
        item({
          relPath: "docs/readme.md",
          leftPath: `${LEFT}/docs/readme.md`,
          direction: "toRight",
          leftKind: "file",
          rightKind: null,
          rightPath: null,
          status: "LeftOnly",
        }),
      ],
      LEFT,
      RIGHT
    );
    // 디렉터리만 남고 그 하위 파일은 제거됨
    expect(result).toHaveLength(1);
    expect(result[0].relPath).toBe("docs");
  });

  it("방향이 다른 항목은 조상 필터링 대상이 아니다", () => {
    const result = buildSyncExecutionOperations(
      [
        item({
          relPath: "docs",
          direction: "toRight",
          leftKind: "directory",
          rightKind: null,
          rightPath: null,
          status: "LeftOnly",
        }),
        item({
          relPath: "docs/readme.md",
          leftPath: null,
          leftKind: null,
          rightPath: `${RIGHT}/docs/readme.md`,
          direction: "toLeft",
          rightKind: "file",
          status: "RightOnly",
        }),
      ],
      LEFT,
      RIGHT
    );
    // 방향이 다르므로 두 항목 모두 유지
    expect(result).toHaveLength(2);
  });

  it("빈 목록은 빈 결과를 반환한다", () => {
    const result = buildSyncExecutionOperations([], LEFT, RIGHT);
    expect(result).toHaveLength(0);
  });
});
