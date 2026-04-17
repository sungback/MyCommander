export const DEFAULT_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

const LEGACY_UI_FONT_FAMILY_PRESETS: Record<string, string> = {
  system: DEFAULT_FONT_FAMILY,
  readable:
    '"Pretendard Variable", Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", sans-serif',
  inter:
    'Inter, "Pretendard Variable", Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", sans-serif',
};

export const normalizeFontFamilyInput = (value: string, fallback: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return fallback;
  }

  return trimmedValue;
};

export const resolvePersistedFontFamily = (value: string, fallback: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return fallback;
  }

  return LEGACY_UI_FONT_FAMILY_PRESETS[trimmedValue] ?? trimmedValue;
};

export const buildFontFamilyStack = (value: string) => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return DEFAULT_FONT_FAMILY;
  }

  return `${trimmedValue}, ${DEFAULT_FONT_FAMILY}`;
};
