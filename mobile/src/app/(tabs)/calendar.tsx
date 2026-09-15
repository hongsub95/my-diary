import { useEffect, useMemo, useState } from 'react';
import { CalendarList, LocaleConfig, type DateData } from 'react-native-calendars';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSchedules } from '@/features/schedules/schedule-queries';
import { ScheduleCard } from '@/features/schedules/schedule-card';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { EmptyState } from '@/shared/components/empty-state';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';

LocaleConfig.locales.ko = {
  monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘',
};
LocaleConfig.defaultLocale = 'ko';

// react-native-calendars supports this runtime override, but its Theme type does not
// expose the dotted key. Keeping it in a spread object preserves type checking for
// all of the public theme properties below.
const CALENDAR_FILL_THEME = {
  'stylesheet.calendar.main': {
    monthView: { flex: 1 },
    week: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginVertical: 0,
    },
  },
};

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

// 예정·기록 대기·기록됨을 색으로 구분한다. 예정과 기록을 같은 점으로 표시하면
// 캘린더가 "무엇이 있었는지"를 알려주지 못한다
// (docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 6절).
const dotColors = (palette: ThemePalette): Record<string, string> => ({
  // 예정만 테마를 따른다. 기록 대기(오렌지)와 기록됨(세이지)은 뜻이 고정된 색이라
  // 테마로 바뀌면 안 된다 (docs/DESIGN_SPEC.md 2.3절).
  planned: palette.primary,
  pending: colors.orange,
  recorded: colors.sage,
});

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function CalendarScreen() {
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  const DOT_COLORS = useMemo(() => dotColors(palette), [palette]);
  const [initialDate] = useState(() => localDateKey());
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { width } = useWindowDimensions();
  const [drawerX] = useState(() => new Animated.Value(-width));
  const [calendarCardHeight, setCalendarCardHeight] = useState(0);
  const calendarContentHeight = Math.max(0, calendarCardHeight - (spacing.xs * 2) - 2);
  const calendarContentWidth = Math.max(1, width - (spacing.lg * 2) - (spacing.xs * 2) - 2);

  // 달을 넘기면 handleMonthChange가 selectedDate를 그 달 1일로 옮기므로, 선택 날짜의
  // 달이 곧 보고 있는 달이다. 장소는 쓰지 않으므로 include를 켜지 않는다.
  const visibleMonth = selectedDate.slice(0, 7);
  const previousMonth = shiftMonth(visibleMonth, -1);
  const nextMonth = shiftMonth(visibleMonth, 1);
  const schedules = useSchedules({
    from: `${previousMonth}-01`,
    to: lastDayOfMonth(nextMonth),
  });

  const schedulesByDate = useMemo(() => {
    const grouped: Record<string, ScheduleView[]> = {};
    for (const schedule of schedules.data ?? []) {
      (grouped[schedule.dateKey] ??= []).push(schedule);
    }
    return grouped;
  }, [schedules.data]);

  const selectedSchedules = useMemo(
    () => (schedules.data ?? []).filter((schedule) => schedule.dateKey === selectedDate),
    [schedules.data, selectedDate],
  );

  useEffect(() => {
    if (!drawerOpen) return;
    drawerX.setValue(-width);
    Animated.timing(drawerX, { duration: 180, toValue: 0, useNativeDriver: true }).start();
  }, [drawerOpen, drawerX, width]);

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    setDrawerOpen(true);
  };
  const closeDrawer = () => Animated.timing(drawerX, { duration: 160, toValue: -width, useNativeDriver: true })
    .start(() => setDrawerOpen(false));
  const handleMonthChange = (monthData: DateData) => {
    const nextVisibleMonth = monthData.dateString.slice(0, 7);
    setSelectedDate(`${nextVisibleMonth}-01`);
  };
  const [, month, day] = selectedDate.split('-').map(Number);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>나의 일정</Text>
          <Text style={styles.title}>캘린더</Text>
        </View>

        <View
          style={styles.calendarCard}
          onLayout={({ nativeEvent }) => setCalendarCardHeight(nativeEvent.layout.height)}
        >
          {calendarContentHeight > 0 && (
          <CalendarList
            style={{ height: calendarContentHeight, width: calendarContentWidth }}
            calendarHeight={calendarContentHeight}
            calendarWidth={calendarContentWidth}
            calendarStyle={{ height: calendarContentHeight, paddingLeft: 5, paddingRight: 5 }}
            current={initialDate}
            monthFormat="yyyy년 MM월"
            onDayPress={handleDayPress}
            onMonthChange={handleMonthChange}
            horizontal
            pagingEnabled
            animateScroll
            decelerationRate="fast"
            disableIntervalMomentum
            hideArrows={false}
            showScrollIndicator={false}
            pastScrollRange={24}
            futureScrollRange={24}
            firstDay={0}
            dayComponent={({ date, state }) => {
              const items = schedulesByDate[date?.dateString ?? ''] ?? [];
              const selected = date?.dateString === selectedDate;
              return (
                <Pressable onPress={() => date && handleDayPress(date)} style={[styles.dayCell, selected && styles.dayCellSelected]}>
                  <Text style={[styles.dayNumber, state === 'disabled' && styles.dayDisabled, selected && styles.dayNumberSelected]}>{date?.day}</Text>
                  {items.slice(0, 2).map((item) => {
                    const kind = item.experience_phase === 'record_pending' ? 'pending' : item.experience_phase === 'recorded' ? 'recorded' : 'planned';
                    return <View key={item.id} style={[styles.eventChip, { backgroundColor: DOT_COLORS[kind] }]}><Text numberOfLines={1} ellipsizeMode="tail" style={styles.eventChipText}>{item.title}</Text></View>;
                  })}
                  {items.length > 2 && <Text style={styles.moreEvents}>…</Text>}
                </Pressable>
              );
            }}
            theme={{
              calendarBackground: colors.surface,
              selectedDayBackgroundColor: palette.primary,
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: palette.primary,
              dayTextColor: colors.text,
              textDisabledColor: colors.border,
              monthTextColor: colors.text,
              arrowColor: palette.primary,
              dotColor: palette.primary,
              textMonthFontSize: 18,
              textMonthFontWeight: '600',
              textDayHeaderFontWeight: '600',
              ...CALENDAR_FILL_THEME,
            }}
          />
          )}
        </View>

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
  content: { flex: 1, padding: spacing.lg, paddingBottom: spacing.md },
  heading: { gap: spacing.xs, marginBottom: spacing.lg },
  eyebrow: { color: palette.primary, fontSize: 14, fontWeight: '600' },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' },
  calendarCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    flex: 1,
    padding: spacing.xs,
  },
  dayCell: { alignItems: 'stretch', flex: 1, minHeight: 0, paddingHorizontal: 2, paddingTop: 3, width: '100%' },
  dayCellSelected: { backgroundColor: palette.primarySoft, borderRadius: 8 },
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
