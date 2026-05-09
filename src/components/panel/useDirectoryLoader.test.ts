import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDirectoryLoader } from "./useDirectoryLoader";

const { mockGetHomeDir, mockResolvePath, mockListDirectory } = vi.hoisted(() => ({
  mockGetHomeDir: vi.fn(),
  mockResolvePath: vi.fn(),
  mockListDirectory: vi.fn(),
}));

vi.mock("../../hooks/useFileSystem", () => ({
  useFileSystem: () => ({
    getHomeDir: mockGetHomeDir,
    resolvePath: mockResolvePath,
    listDirectory: mockListDirectory,
  }),
  getErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.stubGlobal("alert", vi.fn());

const sampleEntries = [
  { name: "docs", path: "/home/user/docs", kind: "directory" as const, size: null, lastModified: null, isHidden: false },
];

const makeProps = (overrides = {}) => ({
  activeTabId: "tab-1",
  currentPath: "/home/user",
  lastUpdated: 0,
  panelId: "left" as const,
  setFiles: vi.fn(),
  setPath: vi.fn(),
  setResolvedPath: vi.fn(),
  showHiddenFiles: false,
  ...overrides,
});

describe("useDirectoryLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("정상 로드: setFiles와 setResolvedPath를 올바른 인수로 호출한다", async () => {
    mockResolvePath.mockResolvedValue("/home/user");
    mockListDirectory.mockResolvedValue(sampleEntries);

    const props = makeProps();
    renderHook(() => useDirectoryLoader(props));

    await waitFor(() => expect(props.setFiles).toHaveBeenCalled());

    expect(props.setFiles).toHaveBeenCalledWith("left", sampleEntries);
    expect(props.setResolvedPath).toHaveBeenCalledWith("left", "/home/user");
  });

  it("currentPath가 '/'이면 홈 디렉터리를 조회하여 경로를 설정한다", async () => {
    mockGetHomeDir.mockResolvedValue("/home/user");
    mockResolvePath.mockResolvedValue("/home/user");
    mockListDirectory.mockResolvedValue(sampleEntries);

    const props = makeProps({ currentPath: "/" });
    renderHook(() => useDirectoryLoader(props));

    await waitFor(() => expect(props.setPath).toHaveBeenCalledWith("left", "/home/user"));
    await waitFor(() => expect(props.setFiles).toHaveBeenCalled());
    expect(props.setFiles).toHaveBeenCalledWith("left", sampleEntries);
  });

  it("resolvePath가 실패하면 원본 경로로 listDirectory를 호출한다", async () => {
    mockResolvePath.mockRejectedValue(new Error("resolve failed"));
    mockListDirectory.mockResolvedValue(sampleEntries);

    const props = makeProps();
    renderHook(() => useDirectoryLoader(props));

    await waitFor(() => expect(props.setFiles).toHaveBeenCalled());
    expect(props.setFiles).toHaveBeenCalledWith("left", sampleEntries);
    // listDirectory는 resolvedPath 대신 원본 activePath로 호출됨
    expect(mockListDirectory).toHaveBeenCalledWith("/home/user", false);
  });

  it("listDirectory 실패 + 이전 경로 존재 → 이전 경로로 되돌린다", async () => {
    // 첫 번째 렌더: 성공
    mockResolvePath.mockResolvedValue("/home/user");
    mockListDirectory.mockResolvedValueOnce(sampleEntries);

    const props = makeProps({ currentPath: "/home/user" });
    const { rerender } = renderHook((p: ReturnType<typeof makeProps>) => useDirectoryLoader(p), {
      initialProps: props,
    });

    await waitFor(() => expect(props.setFiles).toHaveBeenCalledTimes(1));

    // 두 번째 렌더: 실패
    mockListDirectory.mockRejectedValueOnce(new Error("access denied"));
    rerender({ ...props, currentPath: "/home/user/bad", lastUpdated: 1 });

    await waitFor(() =>
      expect(props.setPath).toHaveBeenCalledWith("left", "/home/user", "bad")
    );
  });

  it("listDirectory 실패 + 이전 경로 없음 + '/' 시작 → 홈 디렉터리로 폴백한다", async () => {
    // getHomeDir은 두 번 호출됨 (초기 경로 해석 + 폴백)
    mockGetHomeDir.mockResolvedValue("/home/user");
    mockResolvePath.mockResolvedValue("/home/user");
    // 첫 번째 listDirectory는 실패, 두 번째(폴백)는 성공
    mockListDirectory.mockRejectedValueOnce(new Error("first fail"));
    mockListDirectory.mockResolvedValueOnce(sampleEntries);

    const props = makeProps({ currentPath: "/" });
    renderHook(() => useDirectoryLoader(props));

    await waitFor(() => expect(props.setFiles).toHaveBeenCalled());
    expect(props.setFiles).toHaveBeenCalledWith("left", sampleEntries);
  });

  it("showHiddenFiles: true → listDirectory가 true로 호출된다", async () => {
    mockResolvePath.mockResolvedValue("/home/user");
    mockListDirectory.mockResolvedValue(sampleEntries);

    const props = makeProps({ showHiddenFiles: true });
    renderHook(() => useDirectoryLoader(props));

    await waitFor(() =>
      expect(mockListDirectory).toHaveBeenCalledWith(expect.any(String), true)
    );
  });
});
