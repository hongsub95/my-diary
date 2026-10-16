// 하루의 상태를 화면에 그리는 단일 기준 (docs/CALENDAR_SCREEN_SPEC.md 2026-10-15).
//
// 캘린더 칩, 일정 카드 배지, 날짜 패널 카드가 모두 여기서 모양과 문구를 가져간다. 화면마다
// 따로 정하면 같은 하루가 캘린더에서는 "남기기 전", 카드에서는 "예정"처럼 서로 다른 말을 한다.
// 상태 판단은 서버가 계산한 experience_phase만 본다. status나 날짜로 다시 계산하지 않는다.
// 앱의 mobile/src/features/schedules/phase-tag.tsx와 같은 규칙이다.

/** 상태 모양별 이름. 범례와 화면 읽기 문구에 쓴다. */
export const phaseKindLabels = { plan: '예정', pending: '남기기 전', done: '남긴 하루' }

/**
 * experience_phase를 상태 모양 세 가지로 묶는다.
 *
 * @param {string} phase 일정 응답의 experience_phase
 * @returns {'plan' | 'pending' | 'done'} 예정 · 남기기 전 · 남긴 하루
 */
export function phaseKind(phase) {
  if (phase === 'recorded') return 'done'
  if (phase === 'record_pending') return 'pending'
  // upcoming·today가 예정이다. canceled는 노출 여부가 아직 열린 결정이라 예정 모양으로 두고
  // 문구로만 구분한다(phaseLabel).
  return 'plan'
}

/**
 * 카드 배지에 쓰는 상태 문구. 칩보다 자리가 넉넉해 오늘·취소를 따로 적는다.
 *
 * @param {string} phase 일정 응답의 experience_phase
 */
export function phaseLabel(phase) {
  if (phase === 'today') return '오늘'
  if (phase === 'canceled') return '취소'
  return phaseKindLabels[phaseKind(phase)]
}
