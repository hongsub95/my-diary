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
