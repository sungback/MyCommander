const pad = (value: number, length = 2) => String(value).padStart(length, "0");

// <input type="datetime-local" step="1">이 쓰는 "YYYY-MM-DDTHH:mm:ss" 형식(로컬 시간)으로 바꾼다.
export const formatLocalDateTimeInput = (ms: number): string => {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return (
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
};

// 위 형식의 문자열을 밀리초로 바꾼다. 형식이 틀리거나 없는 날짜(예: 2월 31일)면 null이다.
export const parseLocalDateTimeInput = (value: string): number | null => {
  // 브라우저에 따라 초 뒤에 소수(.000)가 붙을 수 있다. 입력창은 초 단위라 소수는 버린다.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/.exec(
    value.trim()
  );
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  const date = new Date(year, month - 1, day, hour, minute, second);
  // Date는 31일 같은 값을 다음 달로 넘기므로 입력한 값과 같은지 다시 확인한다.
  const isSame =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second;
  return isSame ? date.getTime() : null;
};

// 입력창은 초 단위까지만 다루므로 비교할 때 원래 값의 밀리초를 버린다.
export const truncateToSecond = (ms: number): number => Math.floor(ms / 1000) * 1000;
