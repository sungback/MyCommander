import type { Element, Fill, Slide } from "pptxtojson";
import { PPTX_PARSE_OPTIONS, type PptxParseResponse } from "./pptxParseProtocol";
import type { SlideSize } from "./pptxSlideHtml";

/** 해석한 프레젠테이션. 다 쓰면 `dispose()`로 이미지 객체 URL을 해제해야 한다. */
export interface PptxDeck {
  size: SlideSize;
  slides: Slide[];
  dispose: () => void;
}

export interface ParsePptxDeckOptions {
  signal?: AbortSignal;
  /** Worker를 쓸 수 없으면 null을 돌려준다. 테스트에서 바꿔 끼운다. */
  createWorker?: () => Worker | null;
}

const addBlobUrl = (urls: Set<string>, value: unknown) => {
  if (typeof value === "string" && value.startsWith("blob:")) {
    urls.add(value);
  }
};

const collectFill = (urls: Set<string>, fill: Fill | null | undefined) => {
  if (fill?.type === "image") {
    addBlobUrl(urls, fill.value.blob);
  }
};

const collectElements = (urls: Set<string>, elements: Element[] | undefined) => {
  for (const element of elements ?? []) {
    if ("fill" in element) {
      collectFill(urls, element.fill);
    }
    if (element.type === "image") {
      addBlobUrl(urls, element.blob);
    } else if (element.type === "math") {
      addBlobUrl(urls, element.picBlob);
    } else if (element.type === "video" || element.type === "audio") {
      addBlobUrl(urls, element.blob);
    } else if (element.type === "group" || element.type === "diagram") {
      collectElements(urls, element.elements);
    }
  }
};

/** pptxtojson이 만든 이미지 객체 URL을 모두 모은다. */
export const collectDeckBlobUrls = (slides: Slide[]) => {
  const urls = new Set<string>();
  for (const slide of slides) {
    collectFill(urls, slide.fill);
    collectElements(urls, slide.layoutElements);
    collectElements(urls, slide.elements);
  }
  return urls;
};

/** 해석 결과 안의 문자열 중 `urlMap`에 있는 객체 URL을 새 URL로 바꾼다. 객체를 그 자리에서 고친다. */
export const replaceBlobUrls = <T>(value: T, urlMap: Map<string, string>): T => {
  if (typeof value === "string") {
    return (urlMap.get(value) ?? value) as T;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = replaceBlobUrls(value[index], urlMap);
    }
    return value;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      record[key] = replaceBlobUrls(record[key], urlMap);
    }
  }
  return value;
};

const createDeck = (size: SlideSize, slides: Slide[], blobUrls: Iterable<string>): PptxDeck => {
  const urls = new Set(blobUrls);
  return {
    size,
    slides,
    dispose: () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    },
  };
};

/** Worker의 객체 URL은 Worker가 끝나면 사라지므로, 받은 Blob으로 이 화면의 객체 URL을 다시 만든다. */
const adoptWorkerResult = (response: Extract<PptxParseResponse, { ok: true }>): PptxDeck => {
  const urlMap = new Map(
    response.blobs.map(([workerUrl, blob]) => [workerUrl, URL.createObjectURL(blob)] as const)
  );
  const slides = replaceBlobUrls(response.slides, urlMap);
  return createDeck(response.size, slides, urlMap.values());
};

const createAbortError = () => new DOMException("PPTX 해석을 취소했습니다.", "AbortError");

const defaultCreateWorker = (): Worker | null =>
  typeof Worker === "undefined"
    ? null
    : new Worker(new URL("./pptxParse.worker.ts", import.meta.url), { type: "module" });

/** Worker에서 해석한다. Worker를 만들거나 불러오지 못하면 null로 끝나 호출자가 화면 스레드에서 해석한다. */
const parseInWorker = (
  bytes: ArrayBuffer,
  createWorker: () => Worker | null,
  signal: AbortSignal | undefined
) =>
  new Promise<PptxDeck | null>((resolve, reject) => {
    let worker: Worker | null;
    try {
      worker = createWorker();
    } catch {
      worker = null;
    }
    if (!worker) {
      resolve(null);
      return;
    }

    const activeWorker = worker;
    const finish = () => {
      activeWorker.terminate();
      signal?.removeEventListener("abort", handleAbort);
    };
    const handleAbort = () => {
      finish();
      reject(createAbortError());
    };
    signal?.addEventListener("abort", handleAbort, { once: true });

    activeWorker.onmessage = (event: MessageEvent<PptxParseResponse>) => {
      finish();
      const response = event.data;
      if (response.ok) {
        resolve(adoptWorkerResult(response));
      } else {
        reject(new Error(response.message));
      }
    };
    // 해석 오류는 Worker가 메시지로 보낸다. 여기에 오는 것은 스크립트를 불러오지 못한 경우(구형 웹뷰 등)다.
    activeWorker.onerror = (event) => {
      event.preventDefault();
      finish();
      resolve(null);
    };
    activeWorker.onmessageerror = () => {
      finish();
      reject(new Error("해석 결과를 받지 못했습니다."));
    };
    // 화면 쪽 원본은 텍스트 보기에서 다시 쓰므로 넘기지(transfer) 않고 복사한다. 복사본은 Worker가 끝나면 해제된다.
    activeWorker.postMessage(bytes);
  });

const parseInThread = async (bytes: ArrayBuffer): Promise<PptxDeck> => {
  const { parse } = await import("pptxtojson");
  const result = await parse(bytes, PPTX_PARSE_OPTIONS);
  return createDeck(result.size, result.slides, collectDeckBlobUrls(result.slides));
};

/**
 * PPTX 바이트를 해석한다. 큰 자료에서 화면이 멈추지 않도록 Worker에서 해석하고,
 * Worker를 쓸 수 없으면 화면 스레드에서 해석한다.
 */
export const parsePptxDeck = async (
  bytes: ArrayBuffer,
  { signal, createWorker = defaultCreateWorker }: ParsePptxDeckOptions = {}
): Promise<PptxDeck> => {
  if (signal?.aborted) {
    throw createAbortError();
  }

  const deck = await parseInWorker(bytes, createWorker, signal);
  if (deck) {
    return deck;
  }

  const fallbackDeck = await parseInThread(bytes);
  if (signal?.aborted) {
    fallbackDeck.dispose();
    throw createAbortError();
  }
  return fallbackDeck;
};
