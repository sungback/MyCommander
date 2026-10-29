import type { Options, Slide } from "pptxtojson";
import type { SlideSize } from "./pptxSlideHtml";

/**
 * 이미지는 슬라이드마다 복제하지 않도록 객체 URL(blob) 하나로 받는다.
 * 동영상·오디오는 재생하지 않으므로 읽지 않는다.
 */
export const PPTX_PARSE_OPTIONS: Options = {
  imageMode: "blob",
  videoMode: "none",
  audioMode: "none",
};

/** 해석 Worker(`pptxParse.worker.ts`)가 돌려주는 응답. `blobs`는 Worker에서 만든 객체 URL과 그 Blob이다. */
export type PptxParseResponse =
  | { ok: true; size: SlideSize; slides: Slide[]; blobs: [string, Blob][] }
  | { ok: false; message: string };
