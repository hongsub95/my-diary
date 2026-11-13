// 계절 배경(크리스마스 "눈 오는 골목")의 화면 규칙.
//
// 서버는 사용자가 무엇을 골랐는지만 저장하고, 언제 보이는지와 몇 시부터 밤인지는 여기서
// 기기 시간으로 정한다 (docs/API_SPEC.md 3-U절 seasonal_background_*). 웹도 같은 규칙을
// 따라야 하므로 값을 바꾸면 frontend 쪽도 함께 바꾼다.

import type { SeasonalBackgroundTime } from '@/shared/api/types';

/** 배경이 보이기 시작하는 때(포함). 기기 시간 기준 2026-11-13 0시. */
const SEASON_START = new Date(2026, 10, 13);
/** 배경이 사라지는 때(제외). 12-26이 끝나는 12-27 0시. */
const SEASON_END = new Date(2026, 11, 27);
/** 자동일 때 낮으로 보는 시간대. 7시부터 18시 전까지. */
const DAY_START_HOUR = 7;
const NIGHT_START_HOUR = 18;

/** 더보기 "사용자 설정" 줄 아래 한 줄 설명. 고른 값에 따라 바뀐다. */
export const TIME_MODE_DESCRIPTIONS: Record<SeasonalBackgroundTime, string> = {
  auto: '7시~18시는 낮, 그 밖은 밤으로 바뀌어요',
  day: '시간과 상관없이 늘 낮으로 보여요',
  night: '시간과 상관없이 늘 밤으로 보여요',
};

export const TIME_MODE_LABELS: Record<SeasonalBackgroundTime, string> = { auto: '자동', day: '낮', night: '밤' };
export const TIME_MODES: SeasonalBackgroundTime[] = ['auto', 'day', 'night'];

/**
 * 지금이 계절 배경을 보여주는 기간인지.
 *
 * @param now 기기의 지금 시각
 *
 * 기간 밖이면 사용자가 켜 두었어도 배경과 더보기의 설정 줄을 모두 숨긴다.
 */
export function isSeasonActive(now: Date): boolean {
  return now >= SEASON_START && now < SEASON_END;
}

/**
 * 지금 밤 장면을 보여줄지.
 *
 * @param now 기기의 지금 시각
 * @param mode 사용자가 고른 낮·밤. auto면 시각으로 정한다
 */
export function isNightScene(now: Date, mode: SeasonalBackgroundTime): boolean {
  if (mode === 'day') return false;
  if (mode === 'night') return true;
  const hour = now.getHours();
  return hour < DAY_START_HOUR || hour >= NIGHT_START_HOUR;
}

/**
 * 머리말 D-데이 칩 문구.
 *
 * @param now 기기의 지금 시각
 *
 * 날짜만 비교한다. 시각까지 넣으면 같은 날 안에서도 오전과 오후에 D-n이 달라진다.
 */
export function christmasChipLabel(now: Date): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const christmas = new Date(now.getFullYear(), 11, 25);
  const days = Math.round((christmas.getTime() - today.getTime()) / 86_400_000);
  if (days > 0) return `크리스마스까지 D-${days}`;
  if (days === 0) return '오늘은 크리스마스';
  return '메리 크리스마스';
}

/**
 * 탭마다 배경을 얼마나 깔지.
 *
 * - full: 하늘이 탭 바까지 이어지고 골목은 화면 아래
 * - head: 머리말 뒤에만 골목 장면
 * - chip: 장면 없이 D-데이 칩만 (지도가 화면을 채우는 홈)
 * - none: 아무것도 없음
 *
 * 캘린더는 밤에 머리말로 줄인다. 밤에는 카드 밖 글씨를 흰색으로 바꿔야 하는데 달력 칸
 * 글씨까지 바꾸면 일이 커진다.
 */
export type SeasonScope = 'full' | 'head' | 'chip' | 'none';

export function scopeForTab(tab: string | undefined, night: boolean): SeasonScope {
  switch (tab) {
    case 'schedules':
    case 'records':
    case 'more':
      return 'full';
    case 'calendar':
      return night ? 'head' : 'full';
    case 'home':
      return 'chip';
    default:
      return 'none';
  }
}
