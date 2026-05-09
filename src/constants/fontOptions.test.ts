import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FONT_FAMILY,
  normalizeFontFamilyInput,
  resolvePersistedFontFamily,
  buildFontFamilyStack,
} from './fontOptions';

const READABLE_STACK =
  '"Pretendard Variable", Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", sans-serif';
const INTER_STACK =
  'Inter, "Pretendard Variable", Pretendard, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", sans-serif';

describe('normalizeFontFamilyInput', () => {
  it('returns fallback for empty string', () => {
    expect(normalizeFontFamilyInput('', 'fallback')).toBe('fallback');
  });

  it('returns fallback for whitespace-only string', () => {
    expect(normalizeFontFamilyInput('   ', 'fallback')).toBe('fallback');
  });

  it('returns the value as-is for a normal value', () => {
    expect(normalizeFontFamilyInput('Arial', 'fallback')).toBe('Arial');
  });

  it('trims leading and trailing spaces', () => {
    expect(normalizeFontFamilyInput('  Arial  ', 'fallback')).toBe('Arial');
  });
});

describe('resolvePersistedFontFamily', () => {
  it('returns fallback for empty string', () => {
    expect(resolvePersistedFontFamily('', 'fallback')).toBe('fallback');
  });

  it('returns fallback for whitespace-only string', () => {
    expect(resolvePersistedFontFamily('   ', 'fallback')).toBe('fallback');
  });

  it('resolves legacy key "system" to DEFAULT_FONT_FAMILY', () => {
    expect(resolvePersistedFontFamily('system', 'fallback')).toBe(DEFAULT_FONT_FAMILY);
  });

  it('resolves legacy key "readable" to the readable stack string', () => {
    expect(resolvePersistedFontFamily('readable', 'fallback')).toBe(READABLE_STACK);
  });

  it('resolves legacy key "inter" to the inter stack string', () => {
    expect(resolvePersistedFontFamily('inter', 'fallback')).toBe(INTER_STACK);
  });

  it('passes through unknown values as-is', () => {
    expect(resolvePersistedFontFamily('CustomFont', 'fallback')).toBe('CustomFont');
  });
});

describe('buildFontFamilyStack', () => {
  it('returns DEFAULT_FONT_FAMILY for empty string', () => {
    expect(buildFontFamilyStack('')).toBe(DEFAULT_FONT_FAMILY);
  });

  it('returns DEFAULT_FONT_FAMILY for whitespace-only string', () => {
    expect(buildFontFamilyStack('   ')).toBe(DEFAULT_FONT_FAMILY);
  });

  it('prepends custom font to DEFAULT_FONT_FAMILY', () => {
    expect(buildFontFamilyStack('CustomFont')).toBe(`CustomFont, ${DEFAULT_FONT_FAMILY}`);
  });
});
