import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeWeekStrip } from '@/features/calendar/home-week-strip';
import { parseDate } from '@/features/calendar/calendar-dates';
import { KakaoMap } from '@/features/places/kakao-map';
import { useSchedules } from '@/features/schedules/schedule-queries';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { getApiError } from '@/shared/api/api-error';
import { colors, radii, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { seoulDateKey } from '@/shared/utils/date';
import { SpaceSwitcher } from '@/features/spaces/space-switcher';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function includesDate(schedule: ScheduleView, dateKey: string): boolean {
  return seoulDateKey(schedule.start_at) <= dateKey && seoulDateKey(schedule.end_at) >= dateKey;
}

function scheduleStateLabel(schedule: ScheduleView): string {
  if (schedule.experience_phase === 'today') return '오늘';
  if (schedule.experience_phase === 'record_pending') return '기록 대기';
  if (schedule.experience_phase === 'recorded') return '기록 완료';
  if (schedule.experience_phase === 'canceled') return '취소';
  return '예정';
}

export default function HomeScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [activeScheduleId, setActiveScheduleId] = useState<number | null>(null);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index)),
    [weekStart],
  );
  const selectedDateKey = toDateKey(selectedDate);
  const rangeFrom = toDateKey(weekDates[0]);
  const rangeTo = toDateKey(weekDates[6]);

  const schedules = useSchedules({ from: rangeFrom, to: rangeTo, includePlaces: true });
  const daySchedules = useMemo(
    () =>
      (schedules.data ?? [])
        .filter((schedule) => includesDate(schedule, selectedDateKey))
        .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at)),
    [schedules.data, selectedDateKey],
  );

  const mapData = useMemo(() => {
    const scheduleByMarker = new Map<string, number>();
    const places = daySchedules.flatMap((schedule) =>
      schedule.places.map((place) => {
        const id = `${schedule.id}:${place.id}`;
        scheduleByMarker.set(id, schedule.id);
        return {
          id,
          name: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
        };
      }),
    );
    return { places, scheduleByMarker };
  }, [daySchedules]);

  const sheetHeight = Math.min(540, Math.max(390, windowHeight * 0.7));
  const peekHeight = 184;
  const collapsedY = Math.max(0, sheetHeight - peekHeight);
  const [sheetY] = useState(() => new Animated.Value(collapsedY));
  const [expanded, setExpanded] = useState(false);

  const moveSheet = useCallback(
    (open: boolean) => {
      setExpanded(open);
      Animated.spring(sheetY, {
        toValue: open ? 0 : collapsedY,
        useNativeDriver: true,
        damping: 24,
        stiffness: 230,
        mass: 0.9,
      }).start();
    },
    [collapsedY, sheetY],
  );

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          sheetY.stopAnimation((value) => {
            sheetY.setOffset(value);
            sheetY.setValue(0);
          });
        },
        onPanResponderMove: (_, gesture) => {
          sheetY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          sheetY.flattenOffset();
          if (gesture.vy < -0.45 || gesture.dy < -48) {
            moveSheet(true);
            return;
          }
          if (gesture.vy > 0.45 || gesture.dy > 48) {
            moveSheet(false);
            return;
          }
          moveSheet(expanded);
        },
        onPanResponderTerminate: () => {
          sheetY.flattenOffset();
          moveSheet(expanded);
        },
      }),
    [expanded, moveSheet, sheetY],
  );

  const openNewSchedule = () =>
    router.push({ pathname: '/schedules/new', params: { date: selectedDateKey } });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <SpaceSwitcher />
        <HomeWeekStrip
          selectedDate={selectedDateKey}
          onSelect={(key) => {
            const date = parseDate(key);
            setSelectedDate(date);
            setWeekStart(startOfWeek(date));
            setActiveScheduleId(null);
          }}
        />

        <View style={styles.mapArea}>
          <KakaoMap
            places={mapData.places}
            fullBleed
            showEmptyMap
            onSelect={(markerId) => {
              const scheduleId = mapData.scheduleByMarker.get(markerId);
              if (scheduleId) {
                setActiveScheduleId(scheduleId);
                moveSheet(true);
              }
            }}
          />
        </View>

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              transform: [{
                translateY: sheetY.interpolate({
                  inputRange: [0, collapsedY],
                  outputRange: [0, collapsedY],
                  extrapolate: 'clamp',
                }),
              }],
            },
          ]}>
          <View style={styles.dragArea} {...sheetPanResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? '일정 목록 접기' : '일정 목록 펼치기'}
            onPress={() => moveSheet(!expanded)}
            style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetEyebrow}>
                {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 {WEEKDAYS[selectedDate.getDay()]}요일
              </Text>
              <Text style={styles.sheetTitle}>
                {schedules.isLoading ? '일정을 불러오는 중' : `일정 ${daySchedules.length}개`}
              </Text>
            </View>
            <Pressable onPress={openNewSchedule} hitSlop={10} style={styles.addButton}>
              <Text style={styles.addButtonText}>＋ 일정</Text>
            </Pressable>
          </Pressable>

          <ScrollView
            scrollEnabled={expanded}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}>
            {schedules.isError ? (
              <View style={styles.messageCard}>
                <Text style={styles.messageTitle}>일정을 불러오지 못했어요</Text>
                <Text style={styles.messageBody}>{getApiError(schedules.error).message}</Text>
                <Pressable onPress={() => schedules.refetch()} style={styles.retryButton}>
                  <Text style={styles.retryText}>다시 시도</Text>
                </Pressable>
              </View>
            ) : null}

            {!schedules.isLoading && !schedules.isError && daySchedules.length === 0 ? (
              <Pressable onPress={openNewSchedule} style={styles.messageCard}>
                <Text style={styles.messageTitle}>아직 일정이 없어요</Text>
                <Text style={styles.messageBody}>이날의 장소와 할 일을 가볍게 계획해 보세요.</Text>
                <Text style={styles.emptyAction}>새 일정 만들기 →</Text>
              </Pressable>
            ) : null}

            {daySchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                active={schedule.id === activeScheduleId}
                onPress={() =>
                  router.push({ pathname: '/schedules/[id]', params: { id: schedule.id } })
                }
              />
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function ScheduleCard({
  schedule,
  active,
  onPress,
}: {
  schedule: ScheduleView;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const placeNames = schedule.places.map((place) => place.name);
  const placeSummary = placeNames.length > 0 ? placeNames.slice(0, 2).join(' · ') : '장소 미정';
  const remainingPlaces = Math.max(0, placeNames.length - 2);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.scheduleCard,
        active && styles.activeScheduleCard,
        pressed && styles.pressed,
      ]}>
      <View style={styles.cardTimeColumn}>
        <Text style={styles.cardTime}>{timeFormatter.format(new Date(schedule.start_at))}</Text>
        <View style={styles.routeLine} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text numberOfLines={1} style={styles.cardTitle}>{schedule.title}</Text>
          <View style={styles.stateBadge}>
            <Text style={styles.stateBadgeText}>{scheduleStateLabel(schedule)}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={styles.placeText}>
          {placeSummary}{remainingPlaces > 0 ? ` 외 ${remainingPlaces}곳` : ''}
        </Text>
        <Text style={styles.spaceText}>{schedule.space_name}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  screen: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
  mapArea: { flex: 1, backgroundColor: colors.sand },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    bottom: 0,
    elevation: 15,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    shadowColor: '#2B211E',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
  },
  dragArea: { alignItems: 'center', height: 28, justifyContent: 'center' },
  dragHandle: { backgroundColor: '#D7CEC8', borderRadius: radii.full, height: 4, width: 42 },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingBottom: 8,
    paddingHorizontal: spacing.lg,
  },
  sheetEyebrow: { color: palette.primaryDark, fontSize: 11, fontWeight: '600' },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.5, marginTop: 2 },
  addButton: { backgroundColor: palette.primarySoft, borderRadius: radii.full, paddingHorizontal: 13, paddingVertical: 9 },
  addButtonText: { color: palette.primaryDark, fontSize: 12, fontWeight: '700' },
  sheetContent: { gap: 10, paddingBottom: 28, paddingHorizontal: spacing.md },
  scheduleCard: {
    alignItems: 'stretch',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  activeScheduleCard: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  cardTimeColumn: { alignItems: 'center', paddingRight: 12, width: 58 },
  cardTime: { color: colors.text, fontSize: 12, fontWeight: '700' },
  routeLine: { backgroundColor: palette.primary, borderRadius: 2, flex: 1, marginTop: 9, width: 2 },
  cardBody: { flex: 1, gap: 5 },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardTitle: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  stateBadge: { backgroundColor: colors.surface, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 4 },
  stateBadgeText: { color: palette.primaryDark, fontSize: 10, fontWeight: '700' },
  placeText: { color: colors.muted, fontSize: 12 },
  spaceText: { color: colors.muted, fontSize: 10 },
  chevron: { alignSelf: 'center', color: colors.muted, fontSize: 25, marginLeft: 6 },
  messageCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    minHeight: 100,
    padding: spacing.lg,
  },
  messageTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  messageBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  emptyAction: { color: palette.primaryDark, fontSize: 12, fontWeight: '700', marginTop: 10 },
  retryButton: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 4 },
  retryText: { color: palette.primaryDark, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
