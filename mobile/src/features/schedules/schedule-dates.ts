import { seoulDateKey } from '@/shared/utils/date';

// 날짜 키(YYYY-MM-DD)를 화면 문구로 바꾸는 함수들. 하루 만들기·고치기 폼과 날짜 시트가
// 같은 표기를 쓰도록 한곳에 둔다. 키 자체가 서비스 날짜(한국)라 기기 시간대를 거치지 않는다.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Parts = { year: number; month: number; day: number; weekday: string };

/**
 * 날짜 키를 연·월·일·요일로 쪼갠다.
 *
 * Date를 UTC 자정으로 만들어 UTC 기준으로만 읽는다. 기기 시간대로 읽으면 미국처럼
 * 한국보다 늦은 곳에서 요일이 하루 밀린다.
 */
function parts(key: string): Parts {
  const date = new Date(key + 'T00:00:00Z');
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: WEEKDAYS[date.getUTCDay()] };
}

/** 서비스 기준(한국) 올해. 올해 날짜에는 연도를 붙이지 않는다. */
function thisYear(): number {
  return Number(seoulDateKey(new Date().toISOString()).slice(0, 4));
}

/**
 * 하루를 `10월 16일 (금)`으로 보여준다. 올해가 아니면 `2027년 1월 1일 (금)`처럼 연도를 붙인다.
 *
 * @param key YYYY-MM-DD
 */
export function formatDay(key: string): string {
  const { year, month, day, weekday } = parts(key);
  return `${year === thisYear() ? '' : year + '년 '}${month}월 ${day}일 (${weekday})`;
}

/**
 * 기간을 짧게 보여준다. 폼의 날짜 행처럼 한 줄에 넣을 때 쓴다.
 *
 * - 같은 날: `10월 16일 (금)`
 * - 같은 달: `10월 16일 (금) ~ 17일 (토)` — 뒤쪽 월을 반복하지 않는다
 * - 다른 달: `10월 31일 (토) ~ 11월 1일 (일)`
 * - 다른 해: 양쪽에 연도를 붙인다 (SCHEDULE_DATE_RANGE_SPEC FR-3)
 */
export function formatRangeShort(start: string, end: string): string {
  if (start === end) return formatDay(start);
  const a = parts(start);
  const b = parts(end);
  if (a.year !== b.year) return `${a.year}년 ${a.month}월 ${a.day}일 (${a.weekday}) ~ ${b.year}년 ${b.month}월 ${b.day}일 (${b.weekday})`;
  if (a.month !== b.month) return `${formatDay(start)} ~ ${b.month}월 ${b.day}일 (${b.weekday})`;
  return `${formatDay(start)} ~ ${b.day}일 (${b.weekday})`;
}

/**
 * 시작일·종료일 사이를 `당일` 또는 `N박 N+1일`로 보여준다 (SCHEDULE_DATE_RANGE_SPEC FR-3).
 * 종료일이 시작일보다 앞서는 등 셀 수 없으면 빈 문자열이다.
 */
export function periodBetween(start: string, end: string): string {
  const nights = (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000;
  if (!Number.isFinite(nights) || nights < 0) return '';
  return nights === 0 ? '당일' : `${nights}박 ${nights + 1}일`;
}

/**
 * 기간을 양쪽 다 온전히 보여준다. 날짜 시트처럼 기간 자체가 주인공인 곳에서 쓴다.
 * 예: `10월 16일 (금) – 10월 17일 (토)`
 */
export function formatRangeFull(start: string, end: string): string {
  return start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`;
}
