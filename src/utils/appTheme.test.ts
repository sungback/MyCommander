import { describe, it, expect, vi } from 'vitest';
import { getThemeForDate, getNextThemeTransitionDelay, resolveTheme } from './appTheme';

const makeDate = (hour: number) => {
  const d = new Date(2024, 0, 15, hour, 0, 0, 0);
  return d;
};

describe('getThemeForDate', () => {
  it('hour=7 → light', () => {
    expect(getThemeForDate(makeDate(7))).toBe('light');
  });

  it('hour=18 → light', () => {
    expect(getThemeForDate(makeDate(18))).toBe('light');
  });

  it('hour=19 → dark', () => {
    expect(getThemeForDate(makeDate(19))).toBe('dark');
  });

  it('hour=6 → dark', () => {
    expect(getThemeForDate(makeDate(6))).toBe('dark');
  });

  it('hour=0 → dark', () => {
    expect(getThemeForDate(makeDate(0))).toBe('dark');
  });

  it('hour=23 → dark', () => {
    expect(getThemeForDate(makeDate(23))).toBe('dark');
  });
});

describe('getNextThemeTransitionDelay', () => {
  it('자정(hour=0) → 07:00까지 지연', () => {
    const now = new Date(2024, 0, 15, 0, 0, 0, 0);
    const delay = getNextThemeTransitionDelay(now);
    const expectedMs = 7 * 60 * 60 * 1000;
    expect(delay).toBe(expectedMs);
  });

  it('hour=8 → 19:00까지 지연', () => {
    const now = new Date(2024, 0, 15, 8, 0, 0, 0);
    const delay = getNextThemeTransitionDelay(now);
    const expectedMs = 11 * 60 * 60 * 1000;
    expect(delay).toBe(expectedMs);
  });

  it('hour=20 → 다음날 07:00까지 지연', () => {
    const now = new Date(2024, 0, 15, 20, 0, 0, 0);
    const delay = getNextThemeTransitionDelay(now);
    const expectedMs = 11 * 60 * 60 * 1000;
    expect(delay).toBe(expectedMs);
  });

  it('최솟값 1000ms', () => {
    const now = new Date(2024, 0, 15, 7, 0, 0, 1);
    const delay = getNextThemeTransitionDelay(now);
    expect(delay).toBeGreaterThanOrEqual(1000);
  });
});

describe('resolveTheme', () => {
  it('"light" → "light"', () => {
    expect(resolveTheme('light')).toBe('light');
  });

  it('"dark" → "dark"', () => {
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('"auto" → 낮 시간대 light', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 12, 0, 0));
    expect(resolveTheme('auto')).toBe('light');
    vi.useRealTimers();
  });

  it('"auto" → 밤 시간대 dark', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 22, 0, 0));
    expect(resolveTheme('auto')).toBe('dark');
    vi.useRealTimers();
  });
});
