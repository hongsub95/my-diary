import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Calendar, type DateData } from 'react-native-calendars';
import { colors } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';

export function ScheduleDatePicker({ target, startDate, endDate, onSelect, onClose }: {
  target: 'start' | 'end' | null; startDate: string; endDate: string; onSelect: (date: string) => void; onClose: () => void;
}) {
  const palette = useTheme();
  const current = target === 'end' ? endDate : startDate;
  const anchor = String(target) + ':' + current;
  const [visibleMonth, setVisibleMonth] = useState<{ anchor: string; month: string } | null>(null);
  const month = visibleMonth?.anchor === anchor ? visibleMonth.month : current.slice(0, 7);
  const marks: Record<string, { startingDay: boolean; endingDay: boolean; color: string; textColor: string }> = {};
  // 표시 중인 달과 양쪽 주만 칠하므로 긴 일정도 날짜 수만큼 순회하지 않는다.
  const first = Date.parse(month + '-01T00:00:00Z') - 7 * 86400000;
  for (let index = 0; index < 49; index++) {
    const key = new Date(first + index * 86400000).toISOString().slice(0, 10);
    if (key >= startDate && key <= endDate) marks[key] = { startingDay: key === startDate, endingDay: key === endDate, color: palette.primarySoft, textColor: palette.primaryDark };
  }
  return <Modal transparent animationType="fade" visible={target !== null} onRequestClose={onClose}>
    <Pressable onPress={onClose} style={styles.scrim}>
      <Pressable onPress={event => event.stopPropagation()} style={styles.sheet}>
        <View style={styles.heading}><Text style={styles.title}>{target === 'start' ? '시작일 선택' : '종료일 선택'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="날짜 선택 닫기" onPress={onClose} style={styles.close}><Text style={styles.title}>×</Text></Pressable></View>
        <Calendar key={target} current={current} markingType="period" markedDates={marks} minDate={target === 'end' ? startDate : undefined}
          onVisibleMonthsChange={months => { if (months[0]) setVisibleMonth({ anchor, month: months[0].dateString.slice(0, 7) }); }}
          onDayPress={(day: DateData) => onSelect(day.dateString)} theme={{ arrowColor: palette.primary, todayTextColor: palette.primaryDark, calendarBackground: colors.surface }} />
      </Pressable>
    </Pressable>
  </Modal>;
}
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: colors.surface, borderRadius: 24, padding: 12, maxWidth: 500, width: '100%', alignSelf: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
