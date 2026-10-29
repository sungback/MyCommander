import { parse } from "pptxtojson";
import { PPTX_PARSE_OPTIONS, type PptxParseResponse } from "./pptxParseProtocol";

interface PptxParseWorkerScope {
  onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null;
  postMessage: (message: PptxParseResponse) => void;
}

const workerScope = self as unknown as PptxParseWorkerScope;

// pptxtojson이 이미지마다 만드는 객체 URL의 Blob을 모아 화면 쪽으로 넘긴다.
// Worker에서 만든 객체 URL은 Worker가 끝나면 사라지므로 화면 쪽이 받은 Blob으로 URL을 다시 만든다.
const createdBlobs = new Map<string, Blob>();
const createObjectUrl = URL.createObjectURL.bind(URL);
URL.createObjectURL = (object: Blob | MediaSource) => {
  const url = createObjectUrl(object);
  if (object instanceof Blob) {
    createdBlobs.set(url, object);
  }
  return url;
};

workerScope.onmessage = async (event) => {
  let response: PptxParseResponse;
  try {
    const result = await parse(event.data, PPTX_PARSE_OPTIONS);
    response = { ok: true, size: result.size, slides: result.slides, blobs: [...createdBlobs] };
  } catch (error) {
    response = { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  workerScope.postMessage(response);
  for (const url of createdBlobs.keys()) {
    URL.revokeObjectURL(url);
  }
  createdBlobs.clear();
};
