/**
 * 30분 간격 시각 목록 (`HH:MM`).
 *
 * 하루의 시작·종료 시간과 장소 예정시각이 같은 눈금을 쓴다. 한쪽만 분 단위로 열어 두면
 * "2시 15분"과 "2시 30분"이 섞여 목록에서 시간 순서를 읽기 어려워진다.
 */
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0')
  const minutes = index % 2 === 0 ? '00' : '30'
  return `${hours}:${minutes}`
})

/**
 * 서버의 `HH:MM:SS`를 화면 문구로 바꾼다.
 *
 * @param {string|null} value 예: `14:00:00`
 * @returns {string} 예: `오후 2:00`. 값이 없으면 빈 문자열
 */
export function formatPlannedTime(value) {
  if (!value) return ''
  const [rawHour, minute] = value.split(':')
  const hour = Number(rawHour)
  return `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${minute}`
}

/**
 * 서버 값을 `<select>`가 쓰는 `HH:MM`으로 줄인다.
 *
 * @param {string|null} value 예: `14:00:00`
 * @returns {string} 예: `14:00`. 값이 없으면 빈 문자열("시각 없음")
 */
export function toTimeOption(value) {
  return value ? value.slice(0, 5) : ''
}

/**
 * `<select>` 값을 서버가 받는 `HH:MM:SS`로 늘린다.
 *
 * @param {string} value 예: `14:00`
 * @returns {string|null} 예: `14:00:00`. 빈 값은 null이라 예정시각이 지워진다
 */
export function toApiTime(value) {
  return value ? `${value}:00` : null
}
