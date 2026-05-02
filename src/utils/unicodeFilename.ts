const HANGUL_COMPATIBILITY_JAMO: Record<string, string> = {
  "\u1100": "ㄱ",
  "\u1101": "ㄲ",
  "\u1102": "ㄴ",
  "\u1103": "ㄷ",
  "\u1104": "ㄸ",
  "\u1105": "ㄹ",
  "\u1106": "ㅁ",
  "\u1107": "ㅂ",
  "\u1108": "ㅃ",
  "\u1109": "ㅅ",
  "\u110a": "ㅆ",
  "\u110b": "ㅇ",
  "\u110c": "ㅈ",
  "\u110d": "ㅉ",
  "\u110e": "ㅊ",
  "\u110f": "ㅋ",
  "\u1110": "ㅌ",
  "\u1111": "ㅍ",
  "\u1112": "ㅎ",
  "\u1161": "ㅏ",
  "\u1162": "ㅐ",
  "\u1163": "ㅑ",
  "\u1164": "ㅒ",
  "\u1165": "ㅓ",
  "\u1166": "ㅔ",
  "\u1167": "ㅕ",
  "\u1168": "ㅖ",
  "\u1169": "ㅗ",
  "\u116a": "ㅘ",
  "\u116b": "ㅙ",
  "\u116c": "ㅚ",
  "\u116d": "ㅛ",
  "\u116e": "ㅜ",
  "\u116f": "ㅝ",
  "\u1170": "ㅞ",
  "\u1171": "ㅟ",
  "\u1172": "ㅠ",
  "\u1173": "ㅡ",
  "\u1174": "ㅢ",
  "\u1175": "ㅣ",
  "\u11a8": "ㄱ",
  "\u11a9": "ㄲ",
  "\u11aa": "ㄳ",
  "\u11ab": "ㄴ",
  "\u11ac": "ㄵ",
  "\u11ad": "ㄶ",
  "\u11ae": "ㄷ",
  "\u11af": "ㄹ",
  "\u11b0": "ㄺ",
  "\u11b1": "ㄻ",
  "\u11b2": "ㄼ",
  "\u11b3": "ㄽ",
  "\u11b4": "ㄾ",
  "\u11b5": "ㄿ",
  "\u11b6": "ㅀ",
  "\u11b7": "ㅁ",
  "\u11b8": "ㅂ",
  "\u11b9": "ㅄ",
  "\u11ba": "ㅅ",
  "\u11bb": "ㅆ",
  "\u11bc": "ㅇ",
  "\u11bd": "ㅈ",
  "\u11be": "ㅊ",
  "\u11bf": "ㅋ",
  "\u11c0": "ㅌ",
  "\u11c1": "ㅍ",
  "\u11c2": "ㅎ",
};

const getVisibleDecomposedHangul = (name: string) =>
  Array.from(name)
    .map((character) => HANGUL_COMPATIBILITY_JAMO[character] ?? character)
    .join("");

export const hasDecomposedUnicodeFilename = (name: string) =>
  name !== name.normalize("NFC");

export const getUnicodeFilenameDisplay = (name: string) => {
  const nfcName = name.normalize("NFC");
  const isDecomposed = name !== nfcName;

  return {
    displayName: isDecomposed ? getVisibleDecomposedHangul(name) : name,
    isDecomposed,
    nfcName,
  };
};

export const buildNfcRenameTargetPath = (path: string, name: string) => {
  const nfcName = name.normalize("NFC");
  const slashIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

  return slashIndex === -1
    ? nfcName
    : `${path.slice(0, slashIndex + 1)}${nfcName}`;
};
