// 날짜 시트들이 함께 쓰는 날짜 키('YYYY-MM-DD') 도구.
//
// 키를 문자열로 다루는 이유: 서버와 화면이 모두 이 모양으로 날짜를 주고받고, 문자열
// 비교가 곧 날짜 순서라서 Date 객체의 시간대 문제를 피할 수 있다.

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** 기기의 오늘. */
export function todayKey(): string {
  const now = new Date();
  return toKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function parseKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

/** 'YYYY-MM-DD'의 요일(0=일). 정오로 만들어 서머타임·시간대 경계에서 날짜가 밀리지 않게 한다. */
export function weekdayOf(key: string): number {
  const { year, month, day } = parseKey(key);
  return new Date(year, month - 1, day, 12).getDay();
}

/** "12월 24일 (목)" */
export function dayLabel(key: string): string {
  const { month, day } = parseKey(key);
  return `${month}월 ${day}일 (${WEEKDAYS[weekdayOf(key)]})`;
}

/** 두 날짜 사이 날 수(같은 날이면 1). */
export function daysInclusive(start: string, end: string): number {
  const a = parseKey(start);
  const b = parseKey(end);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000) + 1;
}

/** 달을 앞뒤로 옮긴다. */
export function shiftMonth(year: number, month: number, step: number): { year: number; month: number } {
  const shifted = new Date(year, month - 1 + step, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 };
}

/** 그 달의 1일 요일과 날 수. */
export function monthShape(year: number, month: number): { firstWeekday: number; length: number; rows: number } {
  const firstWeekday = new Date(year, month - 1, 1, 12).getDay();
  const length = new Date(year, month, 0).getDate();
  return { firstWeekday, length, rows: Math.ceil((firstWeekday + length) / 7) };
}
