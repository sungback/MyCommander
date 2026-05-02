import type { AppTheme, ThemePreference } from "../types/theme";

const DAY_START_HOUR = 7;
const NIGHT_START_HOUR = 19;

export const getThemeForDate = (date: Date): AppTheme => {
  const hour = date.getHours();
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR ? "light" : "dark";
};

export const getNextThemeTransitionDelay = (now: Date) => {
  const nextTransition = new Date(now);

  if (now.getHours() < DAY_START_HOUR) {
    nextTransition.setHours(DAY_START_HOUR, 0, 0, 0);
  } else if (now.getHours() < NIGHT_START_HOUR) {
    nextTransition.setHours(NIGHT_START_HOUR, 0, 0, 0);
  } else {
    nextTransition.setDate(nextTransition.getDate() + 1);
    nextTransition.setHours(DAY_START_HOUR, 0, 0, 0);
  }

  return Math.max(nextTransition.getTime() - now.getTime(), 1000);
};

export const resolveTheme = (themePreference: ThemePreference): AppTheme => {
  if (themePreference === "auto") {
    return getThemeForDate(new Date());
  }

  return themePreference;
};
