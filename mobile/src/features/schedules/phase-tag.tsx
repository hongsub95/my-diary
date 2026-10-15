import { StyleSheet, Text, View } from 'react-native';

import { colors, type ThemePalette } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';

// 하루의 상태를 화면에 그리는 단일 기준 (CALENDAR_SCREEN_SPEC 2026-10-15).
//
// 캘린더 칩, 주간 날짜 점, 일정 카드 배지가 모두 여기서 모양을 가져간다. 화면마다 따로
// 정하면 같은 하루가 월간에서는 "남기기 전", 카드에서는 "예정"처럼 서로 다른 말을 한다.
// 상태 판단은 서버가 계산한 experience_phase만 본다. status나 날짜로 다시 계산하지 않는다.

/** 상태 모양. 예정은 테두리만, 남기기 전은 주황 점, 남긴 하루는 채운 바탕에 체크. */
export type PhaseKind = 'plan' | 'pending' | 'done';

export const phaseKindLabels: Record<PhaseKind, string> = { plan: '예정', pending: '남기기 전', done: '남긴 하루' };

/**
 * experience_phase를 상태 모양 세 가지로 묶는다.
 *
 * @param phase 일정 응답의 experience_phase
 * @returns 예정(plan) · 남기기 전(pending) · 남긴 하루(done)
 */
export function phaseKind(phase: string): PhaseKind {
  if (phase === 'recorded') return 'done';
  if (phase === 'record_pending') return 'pending';
  // upcoming·today가 예정이다. canceled는 노출 여부가 아직 열린 결정이라 예정 모양으로 두고
  // 문구로만 구분한다(phaseLabel).
  return 'plan';
}

/**
 * 카드 배지에 쓰는 상태 문구. 칩보다 자리가 넉넉해 오늘·취소를 따로 적는다.
 *
 * @param phase 일정 응답의 experience_phase
 */
export function phaseLabel(phase: string): string {
  if (phase === 'today') return '오늘';
  if (phase === 'canceled') return '취소';
  return phaseKindLabels[phaseKind(phase)];
}

/**
 * 상태 모양별 색. 예정만 사용자가 고른 테마를 따르고, 나머지는 뜻이 고정된 색이다.
 *
 * @param kind 상태 모양
 * @param palette 현재 테마
 * @returns 바탕·테두리·글자 색과 주간 날짜 점 색
 */
export function phaseColors(kind: PhaseKind, palette: ThemePalette) {
  if (kind === 'pending') return { background: colors.orangeSoft, border: colors.orangeSoft, text: colors.orangeDark, dot: colors.orange };
  if (kind === 'done') return { background: colors.sage, border: colors.sage, text: '#FFFFFF', dot: colors.sage };
  return { background: colors.surface, border: palette.primary, text: palette.primaryDark, dot: palette.primary };
}

/**
 * 상태 모양을 입힌 글자 태그.
 *
 * 테두리는 모든 모양에 1씩 둔다(예정이 아니면 바탕과 같은 색). 그래야 모양이 달라도 높이가 같다.
 *
 * @param kind 상태 모양
 * @param label 태그 글자. 캘린더 칩은 하루 제목, 카드 배지는 phaseLabel 문구
 * @param size chip = 월간 날짜 칸(한 줄로 자름), badge = 일정 카드
 */
export function PhaseTag({ kind, label, size }: { kind: PhaseKind; label: string; size: 'chip' | 'badge' }) {
  const tone = phaseColors(kind, useTheme());
  return <View style={[size === 'chip' ? styles.chip : styles.badge, { backgroundColor: tone.background, borderColor: tone.border }]}>
    <Text numberOfLines={1} style={[size === 'chip' ? styles.chipText : styles.badgeText, { color: tone.text }]}>
      {kind === 'pending' && <Text style={{ color: colors.orange, fontSize: size === 'chip' ? 8 : 10 }}>● </Text>}
      {kind === 'done' && '✓ '}{label}
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  chip: { borderRadius: 4, borderWidth: 1, marginBottom: 2, paddingHorizontal: 2, paddingVertical: 1 },
  chipText: { fontSize: 10 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: '600' },
});
