export type CalendarMode = 'month' | 'week' | 'day';
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const parseDate = (key: string) => new Date(`${key}T12:00:00`);
export function moveDate(key: string, mode: CalendarMode, step: number) {
  const date = parseDate(key);
  if (mode === 'month') {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + step);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  } else date.setDate(date.getDate() + step * (mode === 'week' ? 7 : 1));
  return dateKey(date);
}
export function weekDates(key: string) {
  const start = parseDate(key);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => moveDate(dateKey(start), 'day', index));
}
export function dateLabel(key: string) {
  const [year, month, day] = key.split('-');
  return `${year}년 ${month}월 ${day}일`;
}
export function periodLabel(key: string, mode: CalendarMode) {
  if (mode === 'month') return dateLabel(key).slice(0, -4).trim();
  if (mode === 'day') return dateLabel(key);
  const days = weekDates(key);
  const start = days[0];
  const end = days[6];
  const endLabel = start.slice(0, 7) === end.slice(0, 7) ? `${end.slice(8)}일`
    : start.slice(0, 4) === end.slice(0, 4) ? dateLabel(end).slice(6) : dateLabel(end);
  return `${dateLabel(start)} ~ ${endLabel}`;
}

// 달력 장 번호. 1900년 1월부터 2100년 12월까지 달·주·날마다 하나씩 번호를 매긴다(날짜 고르기 범위와 같다).
// 옆으로 넘기는 달력은 이 번호 순서로 장을 한 줄로 깔아 두고, 화면 근처 장만 그린다.
const FIRST_SUNDAY = '1899-12-31'; // 1900-01-01(월)이 든 주의 일요일
const dayNumber = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  // UTC로 세어 서머타임과 상관없이 하루가 늘 24시간이게 한다.
  return Math.round(Date.UTC(year, month - 1, day) / 86_400_000);
};
const fromDayNumber = (value: number) => new Date(value * 86_400_000).toISOString().slice(0, 10);

/**
 * 날짜가 든 장의 번호.
 * @param key 'YYYY-MM-DD'
 * @param mode 월간이면 달, 주간이면 주(일요일 시작), 일간이면 날 번호
 */
export function periodIndex(key: string, mode: CalendarMode) {
  if (mode === 'month') return (Number(key.slice(0, 4)) - 1900) * 12 + Number(key.slice(5, 7)) - 1;
  if (mode === 'week') return Math.floor((dayNumber(key) - dayNumber(FIRST_SUNDAY)) / 7);
  return dayNumber(key) - dayNumber('1900-01-01');
}

/** 장 번호가 가리키는 기간의 첫날('YYYY-MM-DD'). 주간은 그 주 일요일이다. */
export function periodStart(index: number, mode: CalendarMode) {
  if (mode === 'month') return `${1900 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
  if (mode === 'week') return fromDayNumber(dayNumber(FIRST_SUNDAY) + index * 7);
  return fromDayNumber(dayNumber('1900-01-01') + index);
}

/** 모드별 장 수(2100-12-31이 든 장까지). */
export const periodCount = (mode: CalendarMode) => periodIndex('2100-12-31', mode) + 1;
