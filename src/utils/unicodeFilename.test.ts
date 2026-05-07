import { describe, expect, it } from "vitest";
import {
  buildNfcRenameTargetPath,
  getUnicodeFilenameDisplay,
  hasDecomposedUnicodeFilename,
} from "./unicodeFilename";

const nfcKoreanName =
  "01_머신러닝을_활용한_금융데이터_분석-01-백업2.pptx";
const nfdKoreanName = nfcKoreanName.normalize("NFD");
const visibleNfdKoreanName =
  "01_ㅁㅓㅅㅣㄴㄹㅓㄴㅣㅇㅇㅡㄹ_ㅎㅘㄹㅇㅛㅇㅎㅏㄴ_ㄱㅡㅁㅇㅠㅇㄷㅔㅇㅣㅌㅓ_ㅂㅜㄴㅅㅓㄱ-01-ㅂㅐㄱㅇㅓㅂ2.pptx";

describe("unicodeFilename", () => {
  it("detects filenames that differ after NFC normalization", () => {
    expect(hasDecomposedUnicodeFilename(nfdKoreanName)).toBe(true);
    expect(hasDecomposedUnicodeFilename(nfcKoreanName)).toBe(false);
  });

  it("renders decomposed Hangul with visible compatibility jamo", () => {
    expect(getUnicodeFilenameDisplay(nfdKoreanName)).toEqual({
      displayName: visibleNfdKoreanName,
      isDecomposed: true,
      nfcName: nfcKoreanName,
    });
  });

  it("keeps already-composed names unchanged for display", () => {
    expect(getUnicodeFilenameDisplay(nfcKoreanName)).toEqual({
      displayName: nfcKoreanName,
      isDecomposed: false,
      nfcName: nfcKoreanName,
    });
  });

  it("builds an NFC rename target by changing only the final path segment", () => {
    expect(buildNfcRenameTargetPath(`/tmp/${nfdKoreanName}`, nfdKoreanName)).toBe(
      `/tmp/${nfcKoreanName}`
    );
    expect(buildNfcRenameTargetPath(`C:\\tmp\\${nfdKoreanName}`, nfdKoreanName)).toBe(
      `C:\\tmp\\${nfcKoreanName}`
    );
  });
});
