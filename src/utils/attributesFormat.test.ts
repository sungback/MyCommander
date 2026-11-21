import { describe, expect, it } from "vitest";
import {
  formatLocalDateTimeInput,
  parseLocalDateTimeInput,
  truncateToSecond,
} from "./attributesFormat";

describe("attributesFormat", () => {
  it("로컬 시간 입력 형식으로 바꾸고 다시 읽으면 초 단위까지 같다", () => {
    const ms = new Date(2020, 0, 2, 3, 4, 5, 678).getTime();
    const text = formatLocalDateTimeInput(ms);
    expect(text).toBe("2020-01-02T03:04:05");
    expect(parseLocalDateTimeInput(text)).toBe(truncateToSecond(ms));
  });

  it("초가 없는 입력(HH:mm)도 읽는다", () => {
    expect(parseLocalDateTimeInput("2020-01-02T03:04")).toBe(new Date(2020, 0, 2, 3, 4, 0).getTime());
  });

  it("초 뒤의 소수(.000)는 버리고 읽는다", () => {
    expect(parseLocalDateTimeInput("2020-01-02T03:04:05.000")).toBe(
      new Date(2020, 0, 2, 3, 4, 5).getTime()
    );
    expect(parseLocalDateTimeInput("2020-01-02T03:04:05.678")).toBe(
      new Date(2020, 0, 2, 3, 4, 5).getTime()
    );
    expect(parseLocalDateTimeInput("2020-01-02T03:04:05.")).toBeNull();
  });

  it("형식이 틀리거나 없는 날짜는 null이다", () => {
    expect(parseLocalDateTimeInput("")).toBeNull();
    expect(parseLocalDateTimeInput("2020-01-02")).toBeNull();
    expect(parseLocalDateTimeInput("2020-02-31T00:00:00")).toBeNull();
    expect(parseLocalDateTimeInput("2020-13-01T00:00:00")).toBeNull();
    expect(parseLocalDateTimeInput("2020-01-02T25:00:00")).toBeNull();
  });

  it("유효하지 않은 시간은 빈 문자열로 바꾼다", () => {
    expect(formatLocalDateTimeInput(Number.NaN)).toBe("");
  });

  it("밀리초를 버린다(음수는 아래로 내린다)", () => {
    expect(truncateToSecond(1_234)).toBe(1_000);
    expect(truncateToSecond(-1_234)).toBe(-2_000);
  });
});
