import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useFileSystem } from "../../../../hooks/useFileSystem";
import type { PptxRendererModule } from "../quickPreviewRenderers/shared";
import { PagedPreviewLayout, THUMBNAIL_WIDTH } from "../paged/PagedPreviewLayout";
import { getFitScale } from "../paged/pageNavigation";
import type { ParsePptxDeckOptions, PptxDeck } from "./pptxDeck";
import { buildSlideDocument, type SlideSize } from "./pptxSlideHtml";

const PAGE_PADDING = 24;
const PT_TO_PX = 4 / 3;

export interface PptxDeckModule {
  parsePptxDeck: (bytes: ArrayBuffer, options?: ParsePptxDeckOptions) => Promise<PptxDeck>;
}

const defaultLoadDeckModule = async (): Promise<PptxDeckModule> => import("./pptxDeck");

const defaultLoadTextRenderer = async (
  readFileBinary: (path: string) => Promise<ArrayBuffer | Uint8Array>
): Promise<PptxRendererModule> => {
  const { defaultLoadPptxRenderer } = await import("../quickPreviewRenderers/pptxRenderer");
  return defaultLoadPptxRenderer({ readFileBinary });
};

const toArrayBuffer = (bytes: ArrayBuffer | Uint8Array): ArrayBuffer =>
  bytes instanceof Uint8Array
    ? (bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
    : bytes;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

type PptxLoadState =
  | { kind: "loading" }
  | { kind: "ready"; deck: PptxDeck }
  | { kind: "text"; reason: string | null };

interface QuickPreviewPptxViewProps {
  /** asset 프로토콜 URL */
  src: string;
  filePath: string;
  fetchImpl?: typeof fetch;
  readFileBinary?: (path: string) => Promise<ArrayBuffer | Uint8Array>;
  loadDeckModule?: () => Promise<PptxDeckModule>;
  loadTextRenderer?: (
    readFileBinary: (path: string) => Promise<ArrayBuffer | Uint8Array>
  ) => Promise<PptxRendererModule>;
}

/**
 * PPTX 빠른 미리보기. 슬라이드를 실제 배치대로 그려 왼쪽 썸네일과 함께 보여 주고 한 장씩 넘긴다.
 * 해석에 실패하면 슬라이드 텍스트 목록(텍스트 보기)으로 대신한다.
 */
export const QuickPreviewPptxView: React.FC<QuickPreviewPptxViewProps> = ({
  src,
  filePath,
  fetchImpl,
  readFileBinary,
  loadDeckModule = defaultLoadDeckModule,
  loadTextRenderer = defaultLoadTextRenderer,
}) => {
  const { readFileBinary: fsReadFileBinary } = useFileSystem();
  const readBinary = readFileBinary ?? fsReadFileBinary;
  const [loadState, setLoadState] = useState<PptxLoadState>({ kind: "loading" });
  const [showText, setShowText] = useState(false);
  const bytesRef = useRef<ArrayBuffer | null>(null);

  useEffect(() => {
    let disposed = false;
    let openedDeck: PptxDeck | null = null;
    // 닫거나 파일이 바뀌면 진행 중인 해석 Worker를 멈춘다.
    const abortController = new AbortController();
    bytesRef.current = null;
    setLoadState({ kind: "loading" });
    setShowText(false);

    // asset URL은 20 MB 읽기 한도가 없다. 허용 범위 밖 경로 등으로 실패하면 파일을 직접 읽는다.
    const readBytes = async () => {
      try {
        const response = await (fetchImpl ?? fetch)(src);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.arrayBuffer();
      } catch {
        return toArrayBuffer(await readBinary(filePath));
      }
    };

    void (async () => {
      try {
        const bytes = await readBytes();
        if (disposed) {
          return;
        }
        // 텍스트 보기에서 다시 읽지 않도록 원본을 보관한다. 해석기(JSZip)는 버퍼를 넘겨받아 비우지 않으므로 복사하지 않는다.
        bytesRef.current = bytes;

        const deckModule = await loadDeckModule();
        const deck = await deckModule.parsePptxDeck(bytes, { signal: abortController.signal });
        if (disposed) {
          deck.dispose();
          return;
        }
        if (deck.slides.length === 0) {
          deck.dispose();
          setLoadState({ kind: "text", reason: "슬라이드를 찾지 못했습니다." });
          return;
        }

        openedDeck = deck;
        setLoadState({ kind: "ready", deck });
      } catch (error) {
        if (!disposed) {
          setLoadState({ kind: "text", reason: getErrorMessage(error) });
        }
      }
    })();

    return () => {
      disposed = true;
      abortController.abort();
      openedDeck?.dispose();
      bytesRef.current = null;
    };
  }, [src, filePath, fetchImpl, readBinary, loadDeckModule]);

  const deck = loadState.kind === "ready" ? loadState.deck : null;
  const renderPage = useCallback(
    (pageNumber: number) =>
      deck ? <PptxSlideView deck={deck} slideIndex={pageNumber - 1} /> : null,
    [deck]
  );
  const renderThumbnail = useCallback(
    (pageNumber: number) =>
      deck ? (
        <SlideFrame
          deck={deck}
          slideIndex={pageNumber - 1}
          scale={THUMBNAIL_WIDTH / (deck.size.width * PT_TO_PX)}
          title={`${pageNumber}번 슬라이드 썸네일`}
        />
      ) : null,
    [deck]
  );

  if (loadState.kind === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-text-secondary">
        <Loader2 size={24} className="animate-spin" />
        <p className="text-sm">슬라이드를 여는 중입니다</p>
      </div>
    );
  }

  if (loadState.kind === "text" || showText) {
    return (
      <PptxTextView
        filePath={filePath}
        bytesRef={bytesRef}
        readBinary={readBinary}
        loadTextRenderer={loadTextRenderer}
        failureReason={loadState.kind === "text" ? loadState.reason : null}
        onShowSlides={loadState.kind === "ready" ? () => setShowText(false) : undefined}
      />
    );
  }

  const { size } = loadState.deck;
  return (
    <PagedPreviewLayout
      key={src}
      pageCount={loadState.deck.slides.length}
      thumbnailAspectRatio={size.height / Math.max(size.width, 1)}
      thumbnailLabel={(pageNumber) => `${pageNumber}번 슬라이드로 이동`}
      renderPage={renderPage}
      renderThumbnail={renderThumbnail}
      releaseHiddenThumbnails
      toolbarActions={
        <button
          type="button"
          onClick={() => setShowText(true)}
          className="hover:text-text-primary underline-offset-2 hover:underline"
        >
          텍스트 보기
        </button>
      }
    />
  );
};

interface SlideFrameProps {
  deck: PptxDeck;
  slideIndex: number;
  scale: number;
  title: string;
}

/**
 * 슬라이드 한 장을 샌드박스 iframe에 그리고 배율을 적용한다.
 * 스크립트는 허용하지 않고, 포커스를 가져가 화살표 키를 가로채지 않도록 마우스 입력을 받지 않는다.
 */
const SlideFrame: React.FC<SlideFrameProps> = ({ deck, slideIndex, scale, title }) => {
  const html = useMemo(
    () => buildSlideDocument(deck.slides[slideIndex], deck.size),
    [deck, slideIndex]
  );
  const width = deck.size.width * PT_TO_PX;
  const height = deck.size.height * PT_TO_PX;

  return (
    <div className="relative overflow-hidden" style={{ width: width * scale, height: height * scale }}>
      <iframe
        srcDoc={html}
        sandbox="allow-same-origin"
        title={title}
        tabIndex={-1}
        className="absolute left-0 top-0 border-none bg-white pointer-events-none"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      />
    </div>
  );
};

interface PptxSlideViewProps {
  deck: PptxDeck;
  slideIndex: number;
}

/** 현재 슬라이드를 영역에 맞춰 보여 준다. */
const PptxSlideView: React.FC<PptxSlideViewProps> = ({ deck, slideIndex }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [areaSize, setAreaSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const measure = () =>
      setAreaSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const slidePixels: SlideSize = {
    width: deck.size.width * PT_TO_PX,
    height: deck.size.height * PT_TO_PX,
  };
  const scale = areaSize
    ? getFitScale(slidePixels, areaSize.width - PAGE_PADDING * 2, areaSize.height - PAGE_PADDING * 2)
    : null;

  return (
    <div
      ref={containerRef}
      className="flex flex-1 min-h-0 items-center justify-center overflow-hidden bg-bg-secondary"
    >
      {scale !== null && (
        <div className="shadow-lg">
          <SlideFrame
            deck={deck}
            slideIndex={slideIndex}
            scale={scale}
            title={`${slideIndex + 1}번 슬라이드`}
          />
        </div>
      )}
    </div>
  );
};

interface PptxTextViewProps {
  filePath: string;
  bytesRef: React.RefObject<ArrayBuffer | null>;
  readBinary: (path: string) => Promise<ArrayBuffer | Uint8Array>;
  loadTextRenderer: (
    readFileBinary: (path: string) => Promise<ArrayBuffer | Uint8Array>
  ) => Promise<PptxRendererModule>;
  failureReason: string | null;
  onShowSlides?: () => void;
}

/** 슬라이드별 텍스트 목록. 해석에 실패했거나 사용자가 텍스트 보기를 고른 경우에 쓴다. */
const PptxTextView: React.FC<PptxTextViewProps> = ({
  filePath,
  bytesRef,
  readBinary,
  loadTextRenderer,
  failureReason,
  onShowSlides,
}) => {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    setHtml(null);
    setError(null);
    // 이미 읽은 원본이 있으면 다시 읽지 않는다.
    const readForText = async (path: string) => bytesRef.current ?? readBinary(path);

    void loadTextRenderer(readForText)
      .then((renderer) => renderer.renderPptx(filePath))
      .then((renderedHtml) => {
        if (!disposed) {
          setHtml(renderedHtml);
        }
      })
      .catch((textError: unknown) => {
        if (!disposed) {
          setError(getErrorMessage(textError));
        }
      });

    return () => {
      disposed = true;
    };
  }, [bytesRef, filePath, loadTextRenderer, readBinary]);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {(failureReason || onShowSlides) && (
        <div className="flex items-center justify-between gap-3 border-b border-border-color px-3 py-1.5 text-xs text-text-secondary shrink-0">
          {failureReason ? (
            <span className="flex items-center gap-1.5 text-amber-400">
              <AlertCircle size={12} />
              슬라이드를 그리지 못해 텍스트로 보여 줍니다: {failureReason}
            </span>
          ) : (
            <span>텍스트 보기</span>
          )}
          {onShowSlides && (
            <button
              type="button"
              onClick={onShowSlides}
              className="hover:text-text-primary underline-offset-2 hover:underline"
            >
              슬라이드 보기
            </button>
          )}
        </div>
      )}
      {html ? (
        <iframe
          srcDoc={html}
          sandbox="allow-same-origin"
          className="w-full flex-1 border-none"
          title="rendered preview"
        />
      ) : error ? (
        <p className="p-6 text-center text-xs text-red-400">텍스트를 읽지 못했습니다: {error}</p>
      ) : (
        <div className="flex flex-1 items-center justify-center text-text-secondary">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}
    </div>
  );
};
