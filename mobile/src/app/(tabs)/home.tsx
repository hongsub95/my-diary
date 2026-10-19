import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  AccessibilityInfo,
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
import { HomePlaceCard } from '@/features/schedules/home-place-card';
import { homePlaceFocus, orderedHomePlaces } from '@/features/schedules/home-place-model';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { useSpaces } from '@/features/spaces/space-context';
import { getApiError } from '@/shared/api/api-error';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { seoulDateKey } from '@/shared/utils/date';

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const SHEET_HANDLE_HEIGHT = 44;
type SheetLevel = 1 | 2 | 3;

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
  const palette = useTheme();
  const router = useRouter();
  const { currentSpaceId } = useSpaces();
  const { height: windowHeight } = useWindowDimensions();
  const [selectedDate, setSelectedDate] = useState(() => parseDate(seoulDateKey(new Date().toISOString())));
  const [weekStart, setWeekStart] = useState(() => startOfWeek(selectedDate));
  const [selection, setSelection] = useState<{ context: string; scheduleId: number; placeId: number } | null>(null);
  const [mapHeight, setMapHeight] = useState(windowHeight * 0.7);
  const [previewHeight, setPreviewHeight] = useState(240);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; listener.remove(); };
  }, []);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index)),
    [weekStart],
  );
  const selectedDateKey = toDateKey(selectedDate);
  const context = `${currentSpaceId}:${selectedDateKey}`;
  const activeSelection = selection?.context === context ? selection : null;
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
    const scheduleByMarker = new Map<string, { scheduleId: number; placeId: number }>();
    const places = daySchedules.flatMap((schedule) =>
      orderedHomePlaces(schedule).map((place, index) => {
        const id = `${schedule.id}:${place.id}`;
        scheduleByMarker.set(id, { scheduleId: schedule.id, placeId: place.id });
        return {
          id,
          order: index + 1,
          name: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
        };
      }),
    );
    return { places, scheduleByMarker };
  }, [daySchedules]);

  const activeSchedule = daySchedules.find(schedule => schedule.id === activeSelection?.scheduleId) ?? daySchedules[0];
  const focusedPlace = activeSchedule ? homePlaceFocus(activeSchedule, activeSelection?.placeId).place : undefined;
  const selectedMarkerId = activeSchedule && focusedPlace ? `${activeSchedule.id}:${focusedPlace.id}` : undefined;
  const peekHeight = Math.min(mapHeight, SHEET_HANDLE_HEIGHT);
  const previewSheetHeight = Math.min(mapHeight, previewHeight + SHEET_HANDLE_HEIGHT);
  const sheetHeight = Math.min(mapHeight, Math.max(previewSheetHeight, Math.min(560, mapHeight * 0.88)));
  const collapsedY = Math.max(0, sheetHeight - peekHeight);
  const previewY = Math.max(0, sheetHeight - previewSheetHeight);
  const [sheetY] = useState(() => new Animated.Value(previewY));
  const [sheetLevel, setSheetLevel] = useState<SheetLevel>(2);
  const expanded = sheetLevel === 3;
  const snapY = sheetLevel === 1 ? collapsedY : sheetLevel === 2 ? previewY : 0;

  const mapAppearance = useMemo(() => ({
    primary: palette.primary,
    primaryDark: palette.primaryDark,
    bottomInset: sheetLevel === 1 ? peekHeight : sheetLevel === 2 ? previewSheetHeight : sheetHeight,
  }), [palette.primary, palette.primaryDark, sheetLevel, previewSheetHeight, sheetHeight, peekHeight]);

  const moveSheet = useCallback(
    (level: SheetLevel) => {
      setSheetLevel(level);
      const targetY = level === 1 ? collapsedY : level === 2 ? previewY : 0;
      if (reduceMotion) {
        sheetY.setValue(targetY);
        return;
      }
      Animated.spring(sheetY, {
        toValue: targetY,
        useNativeDriver: true,
        damping: 24,
        stiffness: 230,
        mass: 0.9,
      }).start();
    },
    [collapsedY, previewY, reduceMotion, sheetY],
  );

  useEffect(() => {
    if (reduceMotion) {
      sheetY.setValue(snapY);
    } else {
      Animated.spring(sheetY, {
        toValue: snapY,
        useNativeDriver: true,
        damping: 24,
        stiffness: 230,
        mass: 0.9,
      }).start();
    }
    return () => sheetY.stopAnimation();
  }, [snapY, reduceMotion, sheetY]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 4,
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
          if (Math.abs(gesture.dy) < 4 && Math.abs(gesture.dx) < 4) {
            moveSheet(sheetLevel === 3 ? 2 : (sheetLevel + 1) as SheetLevel);
            return;
          }
          if (gesture.vy < -0.45 || gesture.dy < -48) {
            moveSheet(Math.min(3, sheetLevel + 1) as SheetLevel);
            return;
          }
          if (gesture.vy > 0.45 || gesture.dy > 48) {
            moveSheet(Math.max(1, sheetLevel - 1) as SheetLevel);
            return;
          }
          moveSheet(sheetLevel);
        },
        onPanResponderTerminate: () => {
          sheetY.flattenOffset();
          moveSheet(sheetLevel);
        },
      }),
    [sheetLevel, moveSheet, sheetY],
  );

  const openNewSchedule = () =>
    router.push({ pathname: '/schedules/new', params: { date: selectedDateKey } });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.screen}>
        <HomeWeekStrip
          selectedDate={selectedDateKey}
          onSelect={(key) => {
            const date = parseDate(key);
            setSelectedDate(date);
            setWeekStart(startOfWeek(date));
            setSelection(null);
          }}
        />

        <View style={styles.mapArea} onLayout={event => setMapHeight(event.nativeEvent.layout.height)}>
          <KakaoMap
            places={mapData.places}
            selectedId={selectedMarkerId}
            homeAppearance={mapAppearance}
            fullBleed
            showEmptyMap
            onSelect={(markerId) => {
              const point = mapData.scheduleByMarker.get(markerId);
              if (point) {
                setSelection({ context, ...point });
                moveSheet(3);
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
            <Pressable accessibilityRole="button" accessibilityLabel={expanded ? '하루 시트 접기' : '하루 시트 펼치기'} accessibilityValue={{ min: 1, max: 3, now: sheetLevel, text: `${sheetLevel}단계` }} accessibilityState={{ expanded: sheetLevel > 1 }} accessibilityActions={[{ name: 'increment', label: '한 단계 펼치기' }, { name: 'decrement', label: '한 단계 접기' }]} onAccessibilityAction={event => {
              if (event.nativeEvent.actionName === 'increment') moveSheet(Math.min(3, sheetLevel + 1) as SheetLevel);
              if (event.nativeEvent.actionName === 'decrement') moveSheet(Math.max(1, sheetLevel - 1) as SheetLevel);
            }} onPress={() => moveSheet(expanded ? 2 : (sheetLevel + 1) as SheetLevel)} style={styles.handleButton}>
              <View style={styles.dragHandle} />
            </Pressable>
          </View>
          <ScrollView
            style={sheetLevel === 1 && styles.hiddenSheetContent}
            accessibilityElementsHidden={sheetLevel === 1}
            importantForAccessibility={sheetLevel > 1 ? 'auto' : 'no-hide-descendants'}
            scrollEnabled={expanded || collapsedY === 0}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetContent}>
            <View onLayout={event => setPreviewHeight(event.nativeEvent.layout.height)}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeading}>
                  <Text numberOfLines={2} accessibilityRole="header" style={styles.sheetTitle}>
                    {schedules.isLoading ? '하루를 불러오는 중' : activeSchedule?.title ?? '이날의 하루'}
                  </Text>
                  <Text numberOfLines={1} style={styles.sheetSubtitle}>
                    {activeSchedule ? `${activeSchedule.space_name} · 장소 ${activeSchedule.place_count}곳` : `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`}
                  </Text>
                </View>
                {!expanded && <Pressable accessibilityRole="button" accessibilityLabel="일정 목록 최소화" onPress={() => moveSheet(1)} style={styles.minimizeButton}><Text style={styles.smallChevron}>−</Text></Pressable>}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={expanded ? '일정 목록 접기' : '일정 목록 펼치기'}
                  accessibilityState={{ expanded }}
                  onPress={() => moveSheet(expanded ? 2 : 3)}
                  style={styles.expandButton}>
                  <SymbolView name={{ ios: expanded ? 'chevron.down' : 'chevron.up', android: expanded ? 'expand_more' : 'expand_less', web: expanded ? 'expand_more' : 'expand_less' }} size={16} tintColor={colors.muted} fallback={<Text style={styles.smallChevron}>{expanded ? '⌄' : '⌃'}</Text>} />
                  <Text style={styles.expandText}>{expanded ? '접기' : '펼치기'}</Text>
                </Pressable>
              </View>
            {schedules.isError ? (
                <View style={styles.messageCard}>
                <Text style={styles.messageTitle}>하루를 불러오지 못했어요</Text>
                <Text style={styles.messageBody}>{getApiError(schedules.error).message}</Text>
                <Pressable onPress={() => schedules.refetch()} style={styles.retryButton}>
                  <Text style={styles.retryText}>다시 시도</Text>
                </Pressable>
              </View>
            ) : null}

            {!schedules.isLoading && !schedules.isError && daySchedules.length === 0 ? (
              <Pressable onPress={openNewSchedule} style={styles.messageCard}>
                <View style={styles.messageIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <SymbolView name={{ ios: 'map', android: 'map', web: 'map' }} size={22} tintColor={palette.primaryDark} fallback={<Text style={styles.emptyAction}>＋</Text>} />
                </View>
                <Text style={styles.messageTitle}>이날은 예정된 하루가 없어요</Text>
                <Text style={styles.messageBody}>이날의 장소와 할 일을 가볍게 계획해 보세요.</Text>
                <Text style={styles.emptyAction}>새 하루 만들기 →</Text>
              </Pressable>
            ) : null}

            {activeSchedule ? (
              <HomePlaceCard
                key={activeSchedule.id}
                schedule={activeSchedule}
                selectedPlaceId={activeSelection?.placeId}
                onOpen={() => router.push({ pathname: '/schedules/[id]', params: { id: activeSchedule.id } })}
              />
            ) : null}
            </View>

            {expanded && daySchedules.length > 1 ? <Text style={styles.otherTitle}>이날의 다른 하루 · {daySchedules.length - 1}개</Text> : null}
            {expanded ? daySchedules.filter(schedule => schedule.id !== activeSchedule?.id).map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                active={false}
                onPress={() =>
                  router.push({ pathname: '/schedules/[id]', params: { id: schedule.id } })
                }
              />
            )) : null}
            {expanded ? <Pressable accessibilityRole="button" onPress={openNewSchedule} style={styles.newDayButton}>
              <Text style={styles.newDayText}>＋ 새 하루 만들기</Text>
            </Pressable> : null}
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
  const placeNames = orderedHomePlaces(schedule).map((place) => place.name);
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
  mapArea: { flex: 1, backgroundColor: colors.sand },
  smallChevron: { color: colors.muted, fontSize: 18 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    bottom: 0,
    elevation: 15,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    shadowColor: '#432F28',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  dragArea: { height: SHEET_HANDLE_HEIGHT },
  handleButton: { alignItems: 'center', height: SHEET_HANDLE_HEIGHT, justifyContent: 'center' },
  hiddenSheetContent: { display: 'none' },
  dragHandle: { backgroundColor: colors.border, borderRadius: radii.full, height: 4, width: 42 },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 16,
  },
  sheetHeading: { flex: 1, gap: 4 },
  sheetTitle: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold, letterSpacing: -0.4 },
  sheetSubtitle: { color: colors.muted, fontSize: 12 },
  expandButton: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.md, flexDirection: 'row', gap: 4, justifyContent: 'center', minHeight: 44, minWidth: 64 },
  minimizeButton: { alignItems: 'center', backgroundColor: colors.background, borderRadius: radii.md, justifyContent: 'center', minHeight: 44, minWidth: 44 },
  expandText: { color: colors.muted, fontSize: 12 },
  sheetContent: { gap: 10, paddingBottom: 20, paddingHorizontal: spacing.lg },
  otherTitle: { color: colors.muted, fontSize: 12, fontWeight: typography.semibold, marginBottom: 2 },
  newDayButton: { alignItems: 'center', backgroundColor: palette.primarySoft, borderRadius: radii.lg, justifyContent: 'center', minHeight: 44 },
  newDayText: { color: palette.primaryDark, fontSize: typography.body, fontWeight: typography.semibold },
  scheduleCard: {
    alignItems: 'stretch',
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    flexDirection: 'row',
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  activeScheduleCard: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  cardTimeColumn: { alignItems: 'center', paddingRight: 12, width: 58 },
  cardTime: { color: colors.text, fontSize: 12, fontWeight: typography.semibold },
  routeLine: { backgroundColor: palette.primary, borderRadius: 2, flex: 1, marginTop: 9, width: 2 },
  cardBody: { flex: 1, gap: 5 },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardTitle: { color: colors.text, flex: 1, fontSize: typography.emphasis, fontWeight: typography.semibold, letterSpacing: -0.3 },
  stateBadge: { backgroundColor: colors.surface, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 4 },
  stateBadgeText: { color: palette.primaryDark, fontSize: 11, fontWeight: typography.semibold },
  placeText: { color: colors.muted, fontSize: 12 },
  spaceText: { color: colors.muted, fontSize: 11 },
  chevron: { alignSelf: 'center', color: colors.muted, fontSize: 25, marginLeft: 6 },
  messageCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.card,
    minHeight: 100,
    padding: spacing.lg,
  },
  messageIcon: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: palette.primarySoft, borderRadius: radii.md, height: 44, justifyContent: 'center', marginBottom: 12, width: 44 },
  messageTitle: { color: colors.text, fontSize: typography.emphasis, fontWeight: typography.semibold },
  messageBody: { color: colors.muted, fontSize: typography.body, lineHeight: 21, marginTop: 5 },
  emptyAction: { color: palette.primaryDark, fontSize: typography.body, fontWeight: typography.semibold, marginTop: 10 },
  retryButton: { alignSelf: 'flex-start', justifyContent: 'center', marginTop: 10, minHeight: 44, paddingVertical: 4 },
  retryText: { color: palette.primaryDark, fontSize: typography.body, fontWeight: typography.semibold },
  pressed: { opacity: 0.78 },
});
