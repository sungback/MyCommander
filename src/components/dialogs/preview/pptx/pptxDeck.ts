import { parse, type Element, type Fill, type Slide } from "pptxtojson";
import type { SlideSize } from "./pptxSlideHtml";

/** 해석한 프레젠테이션. 다 쓰면 `dispose()`로 이미지 객체 URL을 해제해야 한다. */
export interface PptxDeck {
  size: SlideSize;
  slides: Slide[];
  dispose: () => void;
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

/**
 * PPTX 바이트를 해석한다. 이미지는 슬라이드마다 복제하지 않도록 객체 URL(blob) 하나로 받는다.
 * 동영상·오디오는 재생하지 않으므로 읽지 않는다.
 */
export const parsePptxDeck = async (bytes: ArrayBuffer): Promise<PptxDeck> => {
  const result = await parse(bytes, { imageMode: "blob", videoMode: "none", audioMode: "none" });
  const blobUrls = collectDeckBlobUrls(result.slides);

  return {
    size: result.size,
    slides: result.slides,
    dispose: () => {
      for (const url of blobUrls) {
        URL.revokeObjectURL(url);
      }
      blobUrls.clear();
    },
  };
};
