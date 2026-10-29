import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPageForKey } from "./pageNavigation";

export const THUMBNAIL_WIDTH = 112;

interface PagedPreviewLayoutProps {
  pageCount: number;
  /** 썸네일 자리 표시자 비율(높이 / 너비) */
  thumbnailAspectRatio: number;
  /** 썸네일 버튼의 접근성 이름(예: "3페이지로 이동") */
  thumbnailLabel: (pageNumber: number) => string;
  renderPage: (pageNumber: number) => React.ReactNode;
  /** 목록에서 보이게 된 썸네일만 호출한다. 기본은 한 번 보인 썸네일을 계속 유지한다. */
  renderThumbnail: (pageNumber: number) => React.ReactNode;
  /**
   * true면 목록 밖으로 벗어난 썸네일 내용을 해제한다. 썸네일마다 iframe 문서처럼 무거운 내용을 쓰는 경우,
   * 수백 장을 넘기며 내용이 계속 쌓이지 않게 한다.
   */
  releaseHiddenThumbnails?: boolean;
  toolbarActions?: React.ReactNode;
}

/**
 * 페이지형 문서(PDF, PPTX) 미리보기의 공통 화면.
 * 왼쪽 썸네일 목록과 오른쪽 현재 페이지를 보여 주고, 화살표·PageUp/PageDown·Home/End로 한 장씩 넘긴다.
 * Space·Esc는 미리보기 창이 처리하므로 여기서는 받지 않는다.
 */
export const PagedPreviewLayout: React.FC<PagedPreviewLayoutProps> = ({
  pageCount,
  thumbnailAspectRatio,
  thumbnailLabel,
  renderPage,
  renderThumbnail,
  releaseHiddenThumbnails = false,
  toolbarActions,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(page, 1), Math.max(pageCount, 1)));
  }, [pageCount]);

  useEffect(() => {
    if (pageCount === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (getPageForKey(event.key, 1, pageCount) === null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setCurrentPage((page) => getPageForKey(event.key, page, pageCount) ?? page);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pageCount]);

  return (
    <div className="flex flex-1 min-h-0">
      <ThumbnailList
        pageCount={pageCount}
        currentPage={currentPage}
        thumbnailAspectRatio={thumbnailAspectRatio}
        thumbnailLabel={thumbnailLabel}
        renderThumbnail={renderThumbnail}
        releaseHiddenThumbnails={releaseHiddenThumbnails}
        onSelectPage={setCurrentPage}
      />
      <div className="flex flex-1 min-w-0 flex-col">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-color text-xs text-text-secondary shrink-0">
          <span aria-live="polite">
            {currentPage} / {pageCount}
          </span>
          <span className="flex items-center gap-3">
            <span>↑↓ 페이지 이동</span>
            {toolbarActions}
          </span>
        </div>
        {renderPage(currentPage)}
      </div>
    </div>
  );
};

interface ThumbnailListProps {
  pageCount: number;
  currentPage: number;
  thumbnailAspectRatio: number;
  thumbnailLabel: (pageNumber: number) => string;
  renderThumbnail: (pageNumber: number) => React.ReactNode;
  releaseHiddenThumbnails: boolean;
  onSelectPage: (pageNumber: number) => void;
}

/** 썸네일 세로 목록. 현재 페이지가 보이도록 따라 스크롤한다. */
const ThumbnailList: React.FC<ThumbnailListProps> = ({
  pageCount,
  currentPage,
  thumbnailAspectRatio,
  thumbnailLabel,
  renderThumbnail,
  releaseHiddenThumbnails,
  onSelectPage,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const placeholderHeight = Math.round(THUMBNAIL_WIDTH * thumbnailAspectRatio);
  const pages = useMemo(
    () => Array.from({ length: pageCount }, (_, index) => index + 1),
    [pageCount]
  );

  useEffect(() => {
    itemRefs.current.get(currentPage)?.scrollIntoView?.({ block: "nearest" });
  }, [currentPage]);

  const registerItem = useCallback((pageNumber: number, element: HTMLButtonElement | null) => {
    if (element) {
      itemRefs.current.set(pageNumber, element);
    } else {
      itemRefs.current.delete(pageNumber);
    }
  }, []);

  return (
    <div
      ref={listRef}
      aria-label="페이지 목록"
      className="w-40 shrink-0 overflow-y-auto border-r border-border-color bg-bg-panel py-3"
    >
      {pages.map((pageNumber) => (
        <ThumbnailItem
          key={pageNumber}
          pageNumber={pageNumber}
          isCurrent={pageNumber === currentPage}
          label={thumbnailLabel(pageNumber)}
          placeholderHeight={placeholderHeight}
          scrollRoot={listRef}
          registerItem={registerItem}
          renderThumbnail={renderThumbnail}
          releaseWhenHidden={releaseHiddenThumbnails}
          onSelect={onSelectPage}
        />
      ))}
    </div>
  );
};

interface ThumbnailItemProps {
  pageNumber: number;
  isCurrent: boolean;
  label: string;
  placeholderHeight: number;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  registerItem: (pageNumber: number, element: HTMLButtonElement | null) => void;
  renderThumbnail: (pageNumber: number) => React.ReactNode;
  releaseWhenHidden: boolean;
  onSelect: (pageNumber: number) => void;
}

/**
 * 목록에서 보이게 되면(앞뒤 200px 포함) 내용을 그린다. `releaseWhenHidden`이면 벗어날 때 내용을 해제한다.
 * 페이지를 넘길 때 바뀌는 썸네일(이전·현재)만 다시 렌더링되도록 memo로 감싼다.
 */
const ThumbnailItem = React.memo<ThumbnailItemProps>(function ThumbnailItem({
  pageNumber,
  isCurrent,
  label,
  placeholderHeight,
  scrollRoot,
  registerItem,
  renderThumbnail,
  releaseWhenHidden,
  onSelect,
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = buttonRef.current;
    if (!element) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) {
          return;
        }
        if (releaseWhenHidden) {
          setIsVisible(entry.isIntersecting);
        } else if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { root: scrollRoot.current, rootMargin: "200px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [releaseWhenHidden, scrollRoot]);

  return (
    <button
      ref={(element) => {
        buttonRef.current = element;
        registerItem(pageNumber, element);
      }}
      type="button"
      onClick={() => onSelect(pageNumber)}
      aria-label={label}
      aria-current={isCurrent ? "page" : undefined}
      className="mx-auto mb-3 flex flex-col items-center gap-1 focus:outline-none"
    >
      <span
        className={`relative block overflow-hidden rounded-sm bg-white ${
          isCurrent ? "ring-2 ring-accent-color" : "ring-1 ring-border-color"
        }`}
        style={{ width: THUMBNAIL_WIDTH, height: placeholderHeight }}
      >
        {isVisible && renderThumbnail(pageNumber)}
      </span>
      <span className={`text-xs ${isCurrent ? "text-text-primary" : "text-text-secondary"}`}>
        {pageNumber}
      </span>
    </button>
  );
});
