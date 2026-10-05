import { useEffect, useMemo, useState } from 'react';
import { LocaleConfig } from 'react-native-calendars';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSchedules } from '@/features/schedules/schedule-queries';
import { ScheduleCard } from '@/features/schedules/schedule-card';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { EmptyState } from '@/shared/components/empty-state';
import { colors, radii, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { CalendarExplorer } from '@/features/calendar/calendar-explorer';
import { moveDate } from '@/features/calendar/calendar-dates';
import { seoulDateKey } from '@/shared/utils/date';
import { SpaceSwitcher } from '@/features/spaces/space-switcher';

LocaleConfig.locales.ko = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

/** 'YYYY-MM'이 가리키는 달의 말일을 'YYYY-MM-DD'로 돌려준다. */
function lastDayOfMonth(yearMonth: string) {
  const [year, month] = yearMonth.split('-').map(Number);
  // 다음 달 0일 = 이번 달 말일. 달마다 다른 일수와 윤년을 직접 다루지 않아도 된다.
  const day = new Date(year, month, 0).getDate();
  return `${yearMonth}-${String(day).padStart(2, '0')}`;
}

function shiftMonth(yearMonth: string, offset: number) {
  const [year, month] = yearMonth.split('-').map(Number);
  const shifted = new Date(year, (month - 1) + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function CalendarScreen() {
  const styles = useThemedStyles(createStyles);
  const [initialDate] = useState(() => localDateKey());
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { width } = useWindowDimensions();
  const [drawerX] = useState(() => new Animated.Value(-width));

  // 옆 페이지를 미는 동안에도 일정이 보이도록 앞뒤 한 달을 함께 조회한다.
  const visibleMonth = selectedDate.slice(0, 7);
  const previousMonth = shiftMonth(visibleMonth, -1);
  const nextMonth = shiftMonth(visibleMonth, 1);
  const schedules = useSchedules({
    from: `${previousMonth}-01`,
    to: lastDayOfMonth(nextMonth),
  });

  const schedulesByDate = useMemo(() => {
    const grouped: Record<string, ScheduleView[]> = {};
    for (const schedule of [...(schedules.data ?? [])].sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id - b.id)) {
      const start = schedule.dateKey > `${previousMonth}-01` ? schedule.dateKey : `${previousMonth}-01`;
      const end = seoulDateKey(schedule.end_at) < lastDayOfMonth(nextMonth) ? seoulDateKey(schedule.end_at) : lastDayOfMonth(nextMonth);
      for (let day = start; day <= end; day = moveDate(day, 'day', 1)) {
        (grouped[day] ??= []).push(schedule);
      }
    }
    return grouped;
  }, [schedules.data, previousMonth, nextMonth]);

  const selectedSchedules = useMemo(
    () => schedulesByDate[selectedDate] ?? [],
    [schedulesByDate, selectedDate],
  );

  useEffect(() => {
    if (!drawerOpen) return;
    drawerX.setValue(-width);
    Animated.timing(drawerX, { duration: 180, toValue: 0, useNativeDriver: true }).start();
  }, [drawerOpen, drawerX, width]);

  const handleDayPress = (dateString: string) => {
    setSelectedDate(dateString);
    setDrawerOpen(true);
  };
  const closeDrawer = () => Animated.timing(drawerX, { duration: 160, toValue: -width, useNativeDriver: true })
    .start(() => setDrawerOpen(false));
  const [, month, day] = selectedDate.split('-').map(Number);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <SpaceSwitcher />
      <View style={styles.content}>
        <CalendarExplorer selectedDate={selectedDate} onSelect={setSelectedDate}
          onOpenDay={handleDayPress}
          schedules={schedulesByDate} loading={schedules.isLoading} failed={schedules.isError}
          retry={() => { void schedules.refetch(); }} />

      </View>
      <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={closeDrawer}>
        <View style={styles.drawerLayer}>
          <Pressable accessibilityLabel="일정 목록 닫기" onPress={closeDrawer} style={styles.backdrop} />
          <Animated.View style={[styles.drawer, { width: Math.min(width * 0.88, 380), transform: [{ translateX: drawerX }] }]}>
            <SafeAreaView edges={['top', 'bottom']} style={styles.drawerSafeArea}>
              <View style={styles.drawerHeader}>
                <View><Text style={styles.drawerTitle}>{month}월 {day}일</Text><Text style={styles.drawerCount}>{selectedSchedules.length}개의 일정</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={closeDrawer} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.drawerBody}>
                {selectedSchedules.length > 0 ? <View style={styles.list}>{selectedSchedules.map((schedule) => <ScheduleCard key={schedule.id} schedule={schedule} />)}</View> : <EmptyState compact icon="📅" title="이날은 일정이 없어요" description="다른 날짜를 선택해 보세요." />}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.xl },
  heading: { gap: 6, marginBottom: spacing.xl, paddingHorizontal: 2 },
  eyebrow: { color: palette.primaryDark, fontSize: 12, fontWeight: '600', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -1.1 },
  calendarCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    elevation: 3,
    overflow: 'hidden',
    flex: 1,
    padding: spacing.xs,
    shadowColor: '#432F28',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  dayCell: { alignItems: 'stretch', flex: 1, minHeight: 0, paddingHorizontal: 2, paddingTop: 3, width: '100%' },
  dayCellSelected: { backgroundColor: palette.primarySoft, borderRadius: radii.md },
  dayNumber: { color: colors.text, fontSize: 12, marginBottom: 3, textAlign: 'center' },
  dayNumberSelected: { color: palette.primary, fontWeight: '600' },
  dayDisabled: { color: colors.border },
  eventChip: { borderRadius: 3, marginBottom: 2, minWidth: 0, paddingHorizontal: 3, paddingVertical: 2 },
  eventChipText: { color: '#FFFFFF', fontSize: 8, lineHeight: 10 },
  moreEvents: { color: colors.muted, fontSize: 10, lineHeight: 10, textAlign: 'center' },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, paddingHorizontal: 4 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  legendDot: { borderRadius: 3, height: 6, width: 6 },
  legendText: { color: colors.muted, fontSize: 11 },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sectionCount: { color: palette.primary, fontSize: 14, fontWeight: '600' },
  list: { gap: spacing.md },
  drawerLayer: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(28, 25, 23, 0.35)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  drawer: { bottom: 0, left: 0, position: 'absolute', top: 0 },
  drawerSafeArea: { backgroundColor: colors.background, flex: 1 },
  drawerHeader: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  drawerTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  drawerCount: { color: colors.muted, fontSize: 12, marginTop: 3 },
  closeButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  closeText: { color: colors.muted, fontSize: 28 },
  drawerBody: { flexGrow: 1, padding: spacing.lg },
});
