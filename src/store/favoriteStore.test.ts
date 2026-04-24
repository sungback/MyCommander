import { beforeEach, describe, expect, it } from "vitest";
import { useFavoriteStore } from "./favoriteStore";

const STORAGE_KEY = "total-commander:favorites";

describe("favoriteStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useFavoriteStore.setState({ favorites: [] });
  });

  describe("addFavorite", () => {
    it("경로에서 폴더명을 추출해 즐겨찾기를 추가한다", () => {
      useFavoriteStore.getState().addFavorite("/home/user/Documents");
      const { favorites } = useFavoriteStore.getState();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].name).toBe("Documents");
      expect(favorites[0].path).toBe("/home/user/Documents");
      expect(favorites[0].order).toBe(0);
    });

    it("커스텀 이름을 지정할 수 있다", () => {
      useFavoriteStore.getState().addFavorite("/home/user/Documents", "내 문서");
      expect(useFavoriteStore.getState().favorites[0].name).toBe("내 문서");
    });

    it("이미 등록된 경로는 중복 추가하지 않는다", () => {
      useFavoriteStore.getState().addFavorite("/home/user/Documents");
      useFavoriteStore.getState().addFavorite("/home/user/Documents");
      expect(useFavoriteStore.getState().favorites).toHaveLength(1);
    });

    it("여러 항목 추가 시 order가 순서대로 증가한다", () => {
      useFavoriteStore.getState().addFavorite("/a");
      useFavoriteStore.getState().addFavorite("/b");
      useFavoriteStore.getState().addFavorite("/c");
      const orders = useFavoriteStore.getState().favorites.map((f) => f.order);
      expect(orders).toEqual([0, 1, 2]);
    });

    it("추가 후 localStorage에 저장한다", () => {
      useFavoriteStore.getState().addFavorite("/home/user/Downloads");
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(stored).toHaveLength(1);
      expect(stored[0].path).toBe("/home/user/Downloads");
    });
  });

  describe("removeFavorite", () => {
    it("id로 즐겨찾기를 삭제한다", () => {
      useFavoriteStore.getState().addFavorite("/a");
      useFavoriteStore.getState().addFavorite("/b");
      const id = useFavoriteStore.getState().favorites[0].id;

      useFavoriteStore.getState().removeFavorite(id);

      const { favorites } = useFavoriteStore.getState();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].path).toBe("/b");
    });

    it("삭제 후 order를 재정렬한다", () => {
      useFavoriteStore.getState().addFavorite("/a");
      useFavoriteStore.getState().addFavorite("/b");
      useFavoriteStore.getState().addFavorite("/c");
      const middleId = useFavoriteStore.getState().favorites[1].id;

      useFavoriteStore.getState().removeFavorite(middleId);

      const orders = useFavoriteStore.getState().favorites.map((f) => f.order);
      expect(orders).toEqual([0, 1]);
    });
  });

  describe("renameFavorite", () => {
    it("id로 이름을 변경한다", () => {
      useFavoriteStore.getState().addFavorite("/home/user/Documents");
      const id = useFavoriteStore.getState().favorites[0].id;

      useFavoriteStore.getState().renameFavorite(id, "새 이름");

      expect(useFavoriteStore.getState().favorites[0].name).toBe("새 이름");
    });

    it("이름 변경 후 localStorage에 반영한다", () => {
      useFavoriteStore.getState().addFavorite("/a");
      const id = useFavoriteStore.getState().favorites[0].id;

      useFavoriteStore.getState().renameFavorite(id, "변경됨");

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(stored[0].name).toBe("변경됨");
    });
  });

  describe("reorderFavorites", () => {
    it("드래그한 항목을 드롭 위치로 이동한다", () => {
      useFavoriteStore.getState().addFavorite("/a");
      useFavoriteStore.getState().addFavorite("/b");
      useFavoriteStore.getState().addFavorite("/c");
      const [a, , c] = useFavoriteStore.getState().favorites;

      useFavoriteStore.getState().reorderFavorites(a.id, c.id);

      const paths = useFavoriteStore.getState().favorites.map((f) => f.path);
      expect(paths).toEqual(["/b", "/c", "/a"]);
    });

    it("같은 id면 상태를 변경하지 않는다", () => {
      useFavoriteStore.getState().addFavorite("/a");
      const id = useFavoriteStore.getState().favorites[0].id;
      const before = useFavoriteStore.getState().favorites;

      useFavoriteStore.getState().reorderFavorites(id, id);

      expect(useFavoriteStore.getState().favorites).toBe(before);
    });

    it("reorder 후 order 값이 0부터 연속으로 재부여된다", () => {
      useFavoriteStore.getState().addFavorite("/a");
      useFavoriteStore.getState().addFavorite("/b");
      useFavoriteStore.getState().addFavorite("/c");
      const [a, , c] = useFavoriteStore.getState().favorites;

      useFavoriteStore.getState().reorderFavorites(a.id, c.id);

      const orders = useFavoriteStore.getState().favorites.map((f) => f.order);
      expect(orders).toEqual([0, 1, 2]);
    });
  });
});
