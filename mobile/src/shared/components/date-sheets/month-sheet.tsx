import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { phaseColors, phaseKind, phaseKindLabels, type PhaseKind } from '@/features/schedules/phase-tag';
import { useSchedules } from '@/features/schedules/schedule-queries';
import { colors, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { seoulDateKey } from '@/shared/utils/date';
import { BottomSheet } from './bottom-sheet';
import { monthShape, parseKey, shiftMonth, toKey, todayKey } from './date-keys';
import { MonthGrid } from './month-grid';
import { useHolidays } from './use-holidays';

type MonthSheetProps = {
  visible: boolean;
  /** 지금 고른 날('YYYY-MM-DD') */
  value: string;
  /** "이 주 보기"·"오늘로"로 고른 날을 돌려준다 */
  onSelect: (value: string) => void;
  onClose: () => void;
};

const PHASE_ORDER: PhaseKind[] = ['plan', 'pending', 'done'];

/**
 * 홈 주간 줄에서 여는 월간 시트 (시안 C, 유아이볼 "키피럽" 참고).
 *
 * 날마다 하루 상태 점(예정·남기기 전·남긴 하루)을 찍어, 일정이 있는 날을 보고 그 주로
 * 갈 수 있게 한다. 하루 고르기 시트(A)와 달리 날짜를 눌러도 바로 닫지 않는다 — 점을
 * 보며 몇 날을 둘러보다 "이 주 보기"로 정하는 화면이라서다.
 *
 * 점은 그 달에 걸친 하루를 모두 센다. 여러 날 하루는 걸친 날마다 점이 찍힌다(캘린더 탭과 같다).
 */
export function MonthSheet(props: MonthSheetProps) {
  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} label="달 보기">
      <MonthSheetBody {...props} />
    </BottomSheet>
  );
}

function MonthSheetBody({ value, onSelect, onClose }: MonthSheetProps) {
  const s = useThemedStyles(createStyles);
  const palette = useTheme();
  const today = todayKey();
  const start = parseKey(value || today);
  const [cursor, setCursor] = useState({ year: start.year, month: start.month });
  const [selected, setSelected] = useState(value || today);
  const holidays = useHolidays([cursor.year]);

  const first = toKey(cursor.year, cursor.month, 1);
  const last = toKey(cursor.year, cursor.month, monthShape(cursor.year, cursor.month).length);
  const schedules = useSchedules({ from: first, to: last });
  const phasesByDay = useMemo(() => {
    const map = new Map<string, PhaseKind[]>();
    for (const schedule of schedules.data ?? []) {
      const kind = phaseKind(schedule.experience_phase);
      const from = schedule.dateKey > first ? schedule.dateKey : first;
      const endKey = seoulDateKey(schedule.end_at);
      const to = endKey < last ? endKey : last;
      for (let day = parseKey(from).day; day <= parseKey(to).day && from <= to; day++) {
        const key = toKey(cursor.year, cursor.month, day);
        map.set(key, [...(map.get(key) ?? []), kind]);
      }
    }
    return map;
  }, [cursor.month, cursor.year, first, last, schedules.data]);

  const dots = (key: string) => {
    const kinds = phasesByDay.get(key);
    if (!kinds) return null;
    // 같은 상태는 점 하나로 합치고 최대 세 개만 찍는다. 칸이 좁다.
    const unique = PHASE_ORDER.filter(kind => kinds.includes(kind));
    return (
      <View style={s.dots} accessible={false}>
        {unique.map(kind => <View key={kind} style={[s.dot, { backgroundColor: phaseColors(kind, palette).dot }]} />)}
      </View>
    );
  };

  return (
    <>
      <View style={s.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 달" onPress={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))} style={s.arrow}><Text style={s.arrowText}>‹</Text></Pressable>
        <Text accessibilityRole="header" style={s.navText}>{cursor.year}년 {cursor.month}월</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 달" onPress={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))} style={s.arrow}><Text style={s.arrowText}>›</Text></Pressable>
      </View>
      <MonthGrid year={cursor.year} month={cursor.month} holidays={holidays} today={today} selected={selected} onPress={setSelected} renderExtra={dots} />
      <View style={s.legend}>
        {PHASE_ORDER.map(kind => (
          <View key={kind} style={s.legendItem}>
            <View style={[s.dot, s.legendDot, { backgroundColor: phaseColors(kind, palette).dot }]} />
            <Text style={s.legendText}>{phaseKindLabels[kind]}</Text>
          </View>
        ))}
      </View>
      <View style={s.actions}>
        <Pressable accessibilityRole="button" onPress={() => { onSelect(today); onClose(); }} style={s.secondary}><Text style={s.secondaryText}>오늘로</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { onSelect(selected); onClose(); }} style={s.primary}><Text style={s.primaryText}>이 주 보기</Text></Pressable>
      </View>
    </>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  nav: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 18, marginBottom: 4 },
  arrow: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 22, height: 40, justifyContent: 'center', width: 40 },
  arrowText: { color: colors.muted, fontSize: 20, lineHeight: 22 },
  navText: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 112, textAlign: 'center' },
  dots: { bottom: 2, flexDirection: 'row', gap: 2, position: 'absolute' },
  dot: { borderRadius: 2.5, height: 5, width: 5 },
  legend: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 6 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  legendDot: { borderRadius: 3.5, height: 7, width: 7 },
  legendText: { color: colors.muted, fontSize: 11.5 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondary: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 16, justifyContent: 'center', minHeight: 50, paddingHorizontal: 18 },
  secondaryText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  primary: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 16, flex: 1, justifyContent: 'center', minHeight: 50 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
