// 날짜 시트들이 함께 쓰는 날짜 키('YYYY-MM-DD') 도구. 모바일 date-keys.ts와 같은 규칙이다.
//
// 키를 문자열로 다루는 이유: 서버와 화면이 모두 이 모양으로 날짜를 주고받고, 문자열
// 비교가 곧 날짜 순서라서 Date 객체의 시간대 문제를 피할 수 있다.

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const pad = (n) => String(n).padStart(2, '0')

export const toKey = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`

/** 기기의 오늘 */
export function todayKey() {
  const now = new Date()
  return toKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function parseKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  return { year, month, day }
}

/** 요일(0=일). 정오로 만들어 시간대 경계에서 날짜가 밀리지 않게 한다. */
export function weekdayOf(key) {
  const { year, month, day } = parseKey(key)
  return new Date(year, month - 1, day, 12).getDay()
}

/** "12월 24일 (목)" */
export function dayLabel(key) {
  const { month, day } = parseKey(key)
  return `${month}월 ${day}일 (${WEEKDAYS[weekdayOf(key)]})`
}

/** 두 날짜 사이 박수. 같은 날이면 0 */
export function nightsBetween(start, end) {
  const a = parseKey(start)
  const b = parseKey(end)
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000)
}

/** 당일 / N박 N+1일 (하루 만들기 화면의 표기와 같다) */
export function periodLabel(start, end) {
  const nights = nightsBetween(start, end)
  return nights <= 0 ? '당일' : `${nights}박 ${nights + 1}일`
}

export function shiftMonth(year, month, step) {
  const shifted = new Date(year, month - 1 + step, 1)
  return { year: shifted.getFullYear(), month: shifted.getMonth() + 1 }
}

/** 날짜를 하루 단위로 옮긴다(방향키 이동) */
export function shiftDay(key, step) {
  const { year, month, day } = parseKey(key)
  const date = new Date(year, month - 1, day + step, 12)
  return toKey(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** 그 달의 1일 요일·날 수·줄 수 */
export function monthShape(year, month) {
  const firstWeekday = new Date(year, month - 1, 1, 12).getDay()
  const length = new Date(year, month, 0).getDate()
  return { firstWeekday, length, rows: Math.ceil((firstWeekday + length) / 7) }
}
