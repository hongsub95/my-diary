// 계절 배경(크리스마스 "눈 오는 골목")의 화면 규칙.
//
// 서버는 사용자가 무엇을 골랐는지만 저장하고, 언제 보이는지와 몇 시부터 밤인지는 여기서
// 기기 시간으로 정한다 (docs/API_SPEC.md 3-U절 seasonal_background_*). 모바일의
// mobile/src/features/seasonal/season-rules.ts와 같은 값이어야 한다. 같은 계정이 웹과
// 앱에서 다른 시각에 밤이 되면 안 된다.

/** 배경이 보이기 시작하는 때(포함). 기기 시간 기준 2026-11-13 0시. */
const SEASON_START = new Date(2026, 10, 13)
/** 배경이 사라지는 때(제외). 12-26이 끝나는 12-27 0시. */
const SEASON_END = new Date(2026, 11, 27)
/** 자동일 때 낮으로 보는 시간대. 7시부터 18시 전까지. */
const DAY_START_HOUR = 7
const NIGHT_START_HOUR = 18

/** 더보기 "사용자 설정" 줄 아래 한 줄 설명. 고른 값에 따라 바뀐다. */
export const TIME_MODE_DESCRIPTIONS = {
  auto: '7시~18시는 낮, 그 밖은 밤으로 바뀌어요',
  day: '시간과 상관없이 늘 낮으로 보여요',
  night: '시간과 상관없이 늘 밤으로 보여요',
}

export const TIME_MODE_LABELS = { auto: '자동', day: '낮', night: '밤' }
export const TIME_MODES = ['auto', 'day', 'night']

/**
 * 지금이 계절 배경을 보여주는 기간인지.
 *
 * @param {Date} now 기기의 지금 시각
 *
 * 기간 밖이면 사용자가 켜 두었어도 배경과 더보기의 설정 줄을 모두 숨긴다.
 */
export function isSeasonActive(now) {
  return now >= SEASON_START && now < SEASON_END
}

/**
 * 지금 밤 장면을 보여줄지.
 *
 * @param {Date} now 기기의 지금 시각
 * @param {'auto'|'day'|'night'} mode 사용자가 고른 낮·밤. auto면 시각으로 정한다
 */
export function isNightScene(now, mode) {
  if (mode === 'day') return false
  if (mode === 'night') return true
  const hour = now.getHours()
  return hour < DAY_START_HOUR || hour >= NIGHT_START_HOUR
}

/**
 * 머리말 D-데이 칩 문구. 날짜만 비교한다. 시각까지 넣으면 같은 날 안에서 D-n이 달라진다.
 *
 * @param {Date} now 기기의 지금 시각
 */
export function christmasChipLabel(now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const christmas = new Date(now.getFullYear(), 11, 25)
  const days = Math.round((christmas - today) / 86_400_000)
  if (days > 0) return `크리스마스까지 D-${days}`
  if (days === 0) return '오늘은 크리스마스'
  return '메리 크리스마스'
}

/**
 * 이 주소의 탭이 배경을 입는지.
 *
 * @param {string} pathname 지금 주소
 * @returns {boolean} 탭 첫 화면(홈·캘린더·일정·기록·더보기)이면 true
 *
 * 웹 홈에는 앱과 달리 지도가 없고 카드만 있어서 다른 탭과 같이 화면 전체에 깐다.
 * 하위 화면(하루 상세, 테마 고르기 등)은 입지 않는다. 일을 하는 화면이라 장식이 방해된다.
 */
export function wearsSeason(pathname) {
  return ['/home', '/calendar', '/schedules', '/records', '/more'].includes(pathname)
}
