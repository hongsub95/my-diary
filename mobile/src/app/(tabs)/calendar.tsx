import { useEffect, useMemo, useState } from 'react';
import { LocaleConfig } from 'react-native-calendars';
import { Animated, Dimensions, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMonthlySchedules } from '@/features/schedules/schedule-queries';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { CalendarExplorer } from '@/features/calendar/calendar-explorer';
import { moveDate, parseDate } from '@/features/calendar/calendar-dates';
import { DayAgenda } from '@/features/calendar/day-agenda';
import { SeasonalHeader } from '@/features/seasonal/seasonal-header';
import { useSeasonalScreen } from '@/features/seasonal/use-seasonal-screen';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
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
  // 그날 서랍은 오른쪽에서 열리고, 오른쪽으로 밀면 닫힌다(앱·웹 옆 서랍 공통 규칙).
  // 값이 0이면 열린 자리, 양수만큼 오른쪽 화면 밖으로 밀려 있다.
  const [drawerX] = useState(() => new Animated.Value(width));
  // 계절 배경. 날짜 칸은 흰 카드 안이라 밤에도 카드 밖 제목·설명만 밤 색으로 바꾼다.
  const seasonal = useSeasonalScreen('calendar');
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();

  // 옆 페이지를 미는 동안에도 일정이 보이도록 앞뒤 한 달을 함께 조회한다. 달마다 따로
  // 캐시해서, 달을 넘겨도 이미 받은 달은 비지 않고 바로 보인다(useMonthlySchedules).
  const visibleMonth = selectedDate.slice(0, 7);
  const previousMonth = shiftMonth(visibleMonth, -1);
  const nextMonth = shiftMonth(visibleMonth, 1);
  const schedules = useMonthlySchedules([previousMonth, visibleMonth, nextMonth]);

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
    // data는 매 렌더 새 배열이라, 받은 시각이 바뀔 때만 다시 묶는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules.stamp, previousMonth, nextMonth]);

  const selectedSchedules = useMemo(
    () => schedulesByDate[selectedDate] ?? [],
    [schedulesByDate, selectedDate],
  );

  useEffect(() => {
    if (!drawerOpen) return;
    drawerX.setValue(width);
    Animated.timing(drawerX, { duration: 180, toValue: 0, useNativeDriver: true }).start();
  }, [drawerOpen, drawerX, width]);

  const handleDayPress = (dateString: string) => {
    setSelectedDate(dateString);
    setDrawerOpen(true);
  };
  const closeDrawer = () => Animated.timing(drawerX, { duration: 160, toValue: width, useNativeDriver: true })
    .start(() => setDrawerOpen(false));
  // 서랍을 왼쪽에서 오른쪽으로 밀면 따라 움직이다가, 4분의 1 넘게 밀거나 빠르게 튕기면 닫힌다.
  // 세로로 움직일 때는 잡지 않아 안의 목록 스크롤을 막지 않는다. 한 번만 만들므로 화면 폭은 그때그때 읽는다.
  // 서랍 안 목록(세로 ScrollView)이 터치를 먼저 잡기 때문에, 가로로 미는 움직임은 캡처
  // 단계에서 서랍이 먼저 가져온다. 한 번 잡으면 목록에 넘겨주지 않는다.
  const [swipe] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onMoveShouldSetPanResponder: (_, g) => g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => drawerX.setValue(Math.max(0, g.dx)),
    onPanResponderRelease: (_, g) => {
      const screenWidth = Dimensions.get('window').width;
      if (g.dx > Math.min(screenWidth * 0.88, 380) * 0.25 || g.vx > 0.5) {
        Animated.timing(drawerX, { duration: 140, toValue: screenWidth, useNativeDriver: true }).start(() => setDrawerOpen(false));
      } else Animated.spring(drawerX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(drawerX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
  }));
  const [, month, day] = selectedDate.split('-').map(Number);

  return (
    <View style={[styles.root, seasonal.full && styles.transparent]}>
    {/* 배경 장면은 탭 묶음 뒤에 한 장만 깔려 있다((tabs)/_layout.tsx). 화면은 비워 두어 그 장면을 보인다. */}
    <SafeAreaView edges={['top']} style={[styles.safeArea, seasonal.full && styles.transparent]}>
      <View style={styles.content}>
        {seasonal.showGreeting && <SeasonalHeader night={seasonal.onDarkSky} onNotice={showSnackbar} />}
        <CalendarExplorer selectedDate={selectedDate} onSelect={setSelectedDate}
          onOpenDay={handleDayPress}
          schedules={schedulesByDate} loading={schedules.isLoading} failed={schedules.isError}
          retry={() => { void schedules.refetch(); }}
          seasonal={seasonal} />

      </View>
      <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={closeDrawer}>
        <View style={styles.drawerLayer}>
          <Pressable accessibilityLabel="일정 목록 닫기" onPress={closeDrawer} style={styles.backdrop} />
          <Animated.View {...swipe.panHandlers} style={[styles.drawer, { width: Math.min(width * 0.88, 380), transform: [{ translateX: drawerX }] }]}>
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
      <Snackbar notice={notice} onDismiss={dismissSnackbar} />
    </SafeAreaView>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1, backgroundColor: colors.background },
  transparent: { backgroundColor: 'transparent' },
  content: { flex: 1, padding: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.xl },
  drawerLayer: { flex: 1 },
  backdrop: { backgroundColor: 'rgba(28, 25, 23, 0.35)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  drawer: { borderTopLeftRadius: radii.card, borderBottomLeftRadius: radii.card, bottom: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
  drawerSafeArea: { backgroundColor: colors.background, flex: 1 },
  drawerHeader: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  drawerHeading: { flex: 1 },
  drawerTitle: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold, lineHeight: 26 },
  drawerCount: { color: colors.muted, fontSize: typography.body, marginTop: spacing.xs },
  closeButton: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radii.full, height: 44, justifyContent: 'center', width: 44 },
  closeText: { color: palette.primaryDark, fontSize: 24 },
  drawerBody: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.lg },
});
