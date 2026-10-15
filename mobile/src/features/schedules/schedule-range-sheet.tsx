import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { formatRangeFull, periodBetween } from './schedule-dates';

type Range = { start: string; end: string };

/**
 * 하루의 시작일과 종료일을 달력 한 번으로 고르는 바텀시트.
 *
 * 예전에는 시작일과 종료일 칸을 따로 눌러 달력을 두 번 열었다. 숙박 앱처럼 한 달력에서
 * 시작일 → 종료일을 차례로 누르게 하고, 고르는 동안 위에 `1박 2일`을 바로 보여준다.
 *
 * 고르는 값은 시트 안의 초안이다. **"적용"을 눌러야 폼에 반영**하고, 닫기·바깥 누르기·
 * 뒤로 가기는 초안을 버린다(캘린더 날짜 이동 명세의 임시 날짜 규칙과 같다).
 *
 * @param visible 열려 있는지
 * @param start 폼의 지금 시작일 (YYYY-MM-DD). 열 때마다 초안이 이 값에서 시작한다
 * @param end 폼의 지금 종료일
 * @param onApply 적용한 기간을 받는다
 * @param onClose 적용 없이 닫는다
 */
export function ScheduleRangeSheet({ visible, start, end, onApply, onClose }: {
  visible: boolean;
  start: string;
  end: string;
  onApply: (range: Range) => void;
  onClose: () => void;
}) {
  // 시트가 열릴 때마다 내용을 새로 만든다. 그래야 지난번에 고르다 버린 초안이 남지 않는다.
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      {visible ? <SheetBody start={start} end={end} onApply={onApply} onClose={onClose} /> : null}
    </Modal>
  );
}

function SheetBody({ start, end, onApply, onClose }: Omit<Parameters<typeof ScheduleRangeSheet>[0], 'visible'>) {
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Range>({ start, end });
  // 시작일을 고른 뒤 종료일을 기다리는 중인가. 처음 열었을 때는 기존 기간이 보이고,
  // 다음 누름은 새 기간의 시작일이 된다.
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [month, setMonth] = useState(start.slice(0, 7));

  /**
   * 날짜 하나를 눌렀을 때.
   *
   * 시작일보다 앞을 누르면 그 날부터 다시 시작한다. "종료일은 시작일보다 빠를 수 없다"를
   * 막는 안내 대신 자연스러운 다음 동작으로 받는다.
   */
  function pick(day: string) {
    if (!awaitingEnd || day < draft.start) {
      setDraft({ start: day, end: day });
      setAwaitingEnd(true);
      return;
    }
    setDraft({ start: draft.start, end: day });
    setAwaitingEnd(false);
  }

  // 보이는 달과 앞뒤 한 주만 칠한다. 긴 기간이어도 날짜 수만큼 돌지 않는다.
  const marks: Record<string, { startingDay: boolean; endingDay: boolean; color: string; textColor: string }> = {};
  const first = Date.parse(month + '-01T00:00:00Z') - 7 * 86400000;
  for (let index = 0; index < 49; index++) {
    const key = new Date(first + index * 86400000).toISOString().slice(0, 10);
    if (key < draft.start || key > draft.end) continue;
    const edge = key === draft.start || key === draft.end;
    marks[key] = {
      startingDay: key === draft.start,
      endingDay: key === draft.end,
      color: edge ? palette.primary : palette.primarySoft,
      textColor: edge ? '#FFFFFF' : palette.primaryDark,
    };
  }

  const period = periodBetween(draft.start, draft.end);

  return (
    <View style={styles.root}>
      <Pressable accessibilityLabel="날짜 고르기 닫기" onPress={onClose} style={styles.scrim} />
      <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>날짜 고르기</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="날짜 고르기 닫기" onPress={onClose} style={styles.close}>
            <Text style={styles.closeMark}>×</Text>
          </Pressable>
        </View>
        {/* 고르는 동안 바뀌는 값이라 화면 읽기 도구에도 바로 알린다. */}
        <View accessibilityLiveRegion="polite" style={styles.summary}>
          <Text style={styles.period}>{period}</Text>
          <Text style={styles.range}>{formatRangeFull(draft.start, draft.end)}</Text>
        </View>
        <Calendar
          current={start}
          markingType="period"
          markedDates={marks}
          monthFormat="yyyy년 M월"
          onDayPress={(day: DateData) => pick(day.dateString)}
          onMonthChange={(value: DateData) => setMonth(value.dateString.slice(0, 7))}
          theme={{ arrowColor: palette.primary, todayTextColor: palette.primaryDark, calendarBackground: colors.surface, textDayFontSize: 15, textMonthFontWeight: '600' }}
        />
        <Text style={styles.note}>
          {awaitingEnd ? '종료일을 눌러 주세요. 하루짜리면 바로 적용하면 돼요.' : '시작일 → 종료일 순서로 눌러요.'}
        </Text>
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={() => { setDraft({ start, end }); setAwaitingEnd(false); }} style={styles.reset}>
            <Text style={styles.resetText}>초기화</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onApply(draft)} style={({ pressed }) => [styles.apply, pressed && styles.pressed]}>
            <Text style={styles.applyText}>{period} 적용</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: 'rgba(40, 35, 33, 0.42)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card, paddingHorizontal: 20, paddingTop: 10 },
  handle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: 2, height: 4, marginBottom: 6, width: 40 },
  heading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' },
  close: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  closeMark: { color: colors.muted, fontSize: 26 },
  summary: { gap: 2, marginBottom: 6 },
  period: { color: colors.text, fontSize: 22, fontWeight: '600', letterSpacing: -0.4 },
  range: { color: colors.muted, fontSize: 14 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  footer: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, marginTop: 10, paddingTop: 12 },
  reset: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  resetText: { color: colors.muted, fontSize: 14 },
  apply: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: radii.lg, flex: 1, justifyContent: 'center', minHeight: 54 },
  applyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
