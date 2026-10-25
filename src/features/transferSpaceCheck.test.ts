import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmTransferSpace, findTransferSpaceShortage } from "./transferSpaceCheck";
import { useTransferSpaceWarningStore } from "../store/transferSpaceWarningStore";

const check = (overrides: Partial<{
  requiredBytes: number;
  availableBytes: number | null;
  complete: boolean;
  insufficient: boolean;
}> = {}) => ({
  requiredBytes: 100,
  availableBytes: 1_000,
  complete: true,
  insufficient: false,
  ...overrides,
});

describe("findTransferSpaceShortage", () => {
  it("공간이 충분하면 null을 돌려준다", async () => {
    const client = { checkTransferSpace: vi.fn().mockResolvedValue(check()) };
    await expect(findTransferSpaceShortage(client, ["/a"], "/t", false)).resolves.toBeNull();
    expect(client.checkTransferSpace).toHaveBeenCalledWith(["/a"], "/t", false);
  });

  it("부족하면 필요한 크기와 남은 공간을 돌려준다", async () => {
    const client = {
      checkTransferSpace: vi
        .fn()
        .mockResolvedValue(check({ requiredBytes: 5_000, insufficient: true, complete: false })),
    };
    await expect(findTransferSpaceShortage(client, ["/a"], "/t", true)).resolves.toEqual({
      isMove: true,
      requiredBytes: 5_000,
      availableBytes: 1_000,
      complete: false,
    });
  });

  it("확인 중 오류가 나면 막지 않도록 null을 돌려준다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = { checkTransferSpace: vi.fn().mockRejectedValue(new Error("boom")) };
    await expect(findTransferSpaceShortage(client, ["/a"], "/t", false)).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("확인 함수가 없거나 원본이 없으면 확인하지 않는다", async () => {
    await expect(findTransferSpaceShortage({}, ["/a"], "/t", false)).resolves.toBeNull();
    const client = { checkTransferSpace: vi.fn() };
    await expect(findTransferSpaceShortage(client, [], "/t", false)).resolves.toBeNull();
    expect(client.checkTransferSpace).not.toHaveBeenCalled();
  });
});

describe("confirmTransferSpace", () => {
  beforeEach(() => {
    useTransferSpaceWarningStore.setState({ pending: null });
  });

  it("부족하지 않으면 묻지 않고 진행한다", async () => {
    const client = { checkTransferSpace: vi.fn().mockResolvedValue(check()) };
    await expect(confirmTransferSpace(client, ["/a"], "/t", false)).resolves.toBe(true);
    expect(useTransferSpaceWarningStore.getState().pending).toBeNull();
  });

  it("부족하면 사용자의 답을 그대로 돌려준다", async () => {
    const client = {
      checkTransferSpace: vi.fn().mockResolvedValue(check({ insufficient: true })),
    };
    const answer = confirmTransferSpace(client, ["/a"], "/t", false);
    await vi.waitFor(() => {
      expect(useTransferSpaceWarningStore.getState().pending).not.toBeNull();
    });
    useTransferSpaceWarningStore.getState().respond(false);
    await expect(answer).resolves.toBe(false);
    expect(useTransferSpaceWarningStore.getState().pending).toBeNull();
  });

  it("답하기 전에 새 경고가 오면 이전 요청은 취소로 끝난다", async () => {
    const store = useTransferSpaceWarningStore.getState();
    const shortage = { isMove: false, requiredBytes: 2, availableBytes: 1, complete: true };
    const first = store.requestConfirmation(shortage);
    const second = store.requestConfirmation({ ...shortage, isMove: true });
    await expect(first).resolves.toBe(false);
    useTransferSpaceWarningStore.getState().respond(true);
    await expect(second).resolves.toBe(true);
  });
});
