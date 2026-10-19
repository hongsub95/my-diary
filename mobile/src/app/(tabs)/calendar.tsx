import { useEffect, useMemo, useState } from 'react';
import { LocaleConfig } from 'react-native-calendars';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSchedules } from '@/features/schedules/schedule-queries';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { CalendarExplorer } from '@/features/calendar/calendar-explorer';
import { moveDate, parseDate } from '@/features/calendar/calendar-dates';
import { DayAgenda } from '@/features/calendar/day-agenda';
import { seoulDateKey } from '@/shared/utils/date';

LocaleConfig.locales.ko = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';
const WEEKDAY_NAMES = LocaleConfig.locales.ko.dayNames as string[];

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
            <SafeAreaView edges={['top', 'bottom']} style={styles.drawerSafeArea} accessibilityViewIsModal>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerHeading}><Text accessibilityRole="header" style={styles.drawerTitle}>{month}월 {day}일 {WEEKDAY_NAMES[parseDate(selectedDate).getDay()]}</Text><Text style={styles.drawerCount}>이날의 하루 {selectedSchedules.length}개</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={closeDrawer} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
              </View>
              {/* 일간 보기와 같은 상태별 요약 카드(CALENDAR_SCREEN_SPEC 2026-10-15). 카드에 장소가
                  필요해서 그날 하루를 장소까지 따로 조회한다. 로딩·실패·빈 날도 DayAgenda가 보여 준다. */}
              <ScrollView contentContainerStyle={styles.drawerBody}>
                <DayAgenda day={selectedDate} />
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
  drawerLayer: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(28, 25, 23, 0.35)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  drawer: { borderTopRightRadius: radii.card, borderBottomRightRadius: radii.card, bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', top: 0 },
  drawerSafeArea: { backgroundColor: colors.background, flex: 1 },
  drawerHeader: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  drawerHeading: { flex: 1 },
  drawerTitle: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold, lineHeight: 26 },
  drawerCount: { color: colors.muted, fontSize: typography.body, marginTop: spacing.xs },
  closeButton: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radii.full, height: 44, justifyContent: 'center', width: 44 },
  closeText: { color: palette.primaryDark, fontSize: 24 },
  drawerBody: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.lg },
});
