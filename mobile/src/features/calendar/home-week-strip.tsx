import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { FlatList, Platform, Pressable, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { MonthSheet } from '@/shared/components/date-sheets/month-sheet';

import { colors, radii, typography, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { dateKey, moveDate, parseDate, weekDates } from './calendar-dates';
import { NIGHT_TEXT, NIGHT_TEXT_SHADOW } from '@/features/seasonal/scene-colors';
import { SnowCapped } from '@/features/seasonal/snow-cap';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEK_PAGE_RADIUS = 520;
const WEEK_PAGES = Array.from({ length: WEEK_PAGE_RADIUS * 2 + 1 }, (_, index) => index - WEEK_PAGE_RADIUS);
const WEEK_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const WEEK_VIEWABILITY = { itemVisiblePercentThreshold: 90 };

function weekPageIndex(anchor: string, date: string) {
  const start = (key: string) => Date.parse(`${weekDates(key)[0]}T00:00:00Z`);
  return WEEK_PAGE_RADIUS + Math.round((start(date) - start(anchor)) / WEEK_MILLISECONDS);
}

/** 고정된 주 페이지를 탐색한다. 스와이프 후 가운데로 되돌리지 않는다. */
export function HomeWeekStrip({ selectedDate, onSelect, seasonal }: {
  selectedDate: string;
  onSelect: (date: string) => void;
  /** 계절 배경. active면 바탕을 비워 뒤의 하늘이 보이게 하고 날짜 카드 위에 눈을 얹는다 */
  seasonal?: { active: boolean; night: boolean; onDarkSky: boolean };
}) {
  const styles = useThemedStyles(createStyles);
  const onSky = seasonal?.active ?? false;
  const dark = seasonal?.onDarkSky ?? false;
  const pager = useRef<FlatList<number>>(null);
  const scrollOffset = useRef(0);
  const webSnapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [width, setWidth] = useState(0);
  const [visibleDate, setVisibleDate] = useState(selectedDate);
  const [navigationDate, setNavigationDate] = useState(selectedDate);
  const [anchorDate, setAnchorDate] = useState(selectedDate);
  const [previousSelectedDate, setPreviousSelectedDate] = useState(selectedDate);
  if (previousSelectedDate !== selectedDate) {
    setPreviousSelectedDate(selectedDate);
    setVisibleDate(selectedDate);
    setNavigationDate(selectedDate);
    const index = weekPageIndex(anchorDate, selectedDate);
    if (index < 0 || index >= WEEK_PAGES.length) setAnchorDate(selectedDate);
  }
  const pageIndex = weekPageIndex(anchorDate, navigationDate);
  const today = dateKey(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<number>[] }) => {
    const page = viewableItems.find(item => item.isViewable);
    // 같은 페이지의 알림이 중복되어도 동일한 주를 표시한다.
    if (page) setVisibleDate(moveDate(anchorDate, 'week', page.item));
  }, [anchorDate]);

  useEffect(() => () => {
    if (webSnapTimer.current !== null) clearTimeout(webSnapTimer.current);
  }, [anchorDate, width]);

  useLayoutEffect(() => {
    const offset = pageIndex * width;
    // 일반 스와이프는 이미 올바른 위치에 있으므로 native scroll을 다시 호출하지 않는다.
    // 월 이동·오늘·화면 크기 변경 때만 필요한 위치로 직접 이동한다.
    if (width > 0 && Math.abs(scrollOffset.current - offset) > 1) {
      scrollOffset.current = offset;
      pager.current?.scrollToOffset({ offset, animated: false });
    }
  }, [pageIndex, width]);

  const showDate = (key: string) => {
    const index = weekPageIndex(anchorDate, key);
    if (index < 0 || index >= WEEK_PAGES.length) {
      setAnchorDate(key);
    } else if (width > 0 && Math.abs(scrollOffset.current - index * width) > 1) {
      // 같은 선택일의 '오늘'도 탐색 중인 다른 주에서 돌아와야 한다.
      scrollOffset.current = index * width;
      pager.current?.scrollToOffset({ offset: index * width, animated: false });
    }
    setVisibleDate(key);
    setNavigationDate(key);
  };

  const openPicker = () => setPickerOpen(true);
  const selectDate = (key: string) => {
    showDate(key);
    onSelect(key);
  };

  return (
    <View style={[styles.root, onSky && styles.rootOnSky]}>
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${Number(visibleDate.slice(0, 4))}년 ${Number(visibleDate.slice(5, 7))}월, 월 선택 열기`}
          accessibilityState={{ expanded: pickerOpen }}
          onPress={openPicker}
          style={styles.monthButton}>
          <Text style={[styles.monthTitle, dark && styles.monthTitleNight]}>
            {Number(visibleDate.slice(0, 4))}년 {Number(visibleDate.slice(5, 7))}월
          </Text>
          <SymbolView
            name={{ ios: 'chevron.down', android: 'expand_more' }}
            size={18}
            tintColor={dark ? NIGHT_TEXT.muted : colors.muted}
            fallback={<View style={[styles.chevronDown, dark && styles.chevronDownNight]} />}
          />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => selectDate(today)} style={styles.todayButton}>
          <Text style={styles.todayText}>오늘</Text>
        </Pressable>
      </View>
      <View style={styles.divider} />
      <SnowCapped show={onSky} night={seasonal?.night ?? false}>
      <View style={styles.viewport} onLayout={event => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth !== width) {
          setNavigationDate(visibleDate);
          setWidth(nextWidth);
        }
      }}>
        {width > 0 && (
          <FlatList
            key={`${anchorDate}:${width}`}
            ref={pager}
            data={WEEK_PAGES}
            extraData={selectedDate}
            keyExtractor={offset => String(offset)}
            horizontal
            pagingEnabled={Platform.OS !== 'web'}
            snapToInterval={width}
            disableIntervalMomentum
            decelerationRate="fast"
            directionalLockEnabled
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={pageIndex}
            getItemLayout={(_, index) => ({ length: width, offset: index * width, index })}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            viewabilityConfig={WEEK_VIEWABILITY}
            onViewableItemsChanged={onViewableItemsChanged}
            scrollEventThrottle={16}
            onScroll={event => {
              scrollOffset.current = event.nativeEvent.contentOffset.x;
              // 웹의 CSS snap은 가상 목록의 빈 공간까지 페이지로 취급하므로 직접 정착시킨다.
              if (Platform.OS === 'web') {
                if (webSnapTimer.current !== null) clearTimeout(webSnapTimer.current);
                webSnapTimer.current = setTimeout(() => {
                  const offset = Math.round(scrollOffset.current / width) * width;
                  if (Math.abs(scrollOffset.current - offset) > 1) {
                    pager.current?.scrollToOffset({ offset, animated: false });
                  }
                }, 120);
              }
            }}
            renderItem={({ item }) => (
              <View style={[styles.weekRow, { width }]}>
                {weekDates(moveDate(anchorDate, 'week', item)).map((key, index) => {
                  const date = parseDate(key);
                  const selected = key === selectedDate;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[index]}요일${key === today ? ', 오늘' : ''}`}
                      onPress={() => selectDate(key)}
                      style={[styles.dayButton, selected && styles.selectedDayButton]}>
                      <Text style={[styles.weekday, index === 0 && styles.sunday, index === 6 && styles.saturday, selected && styles.selectedWeekday]}>{WEEKDAYS[index]}</Text>
                      <View style={styles.dateCircle}>
                        <Text style={[styles.dateNumber, selected && styles.selectedDateNumber]}>{date.getDate()}</Text>
                      </View>
                      <View style={[styles.todayDot, key === today && !selected && styles.todayDotVisible]} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        )}
      </View>
      </SnowCapped>

      {/* 달 이름을 누르면 하루 상태 점이 찍힌 월간 시트가 올라온다. 고른 날의 주로 옮기고 그날을 고른다. */}
      <MonthSheet visible={pickerOpen} value={selectedDate} onSelect={selectDate} onClose={() => setPickerOpen(false)} />
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  root: { zIndex: 3, backgroundColor: colors.background, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
  // 아랫단 눈 둔덕(16px)이 날짜 카드에 닿지 않게 아래 여백을 조금 늘린다.
  rootOnSky: { backgroundColor: 'transparent', paddingBottom: 18 },
  monthTitleNight: { color: NIGHT_TEXT.strong, ...NIGHT_TEXT_SHADOW },
  chevronDownNight: { borderColor: NIGHT_TEXT.muted },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5 },
  monthButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  monthTitle: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold, letterSpacing: -0.4 },
  chevronDown: { width: 9, height: 9, borderBottomWidth: 2, borderRightWidth: 2, borderColor: colors.muted, transform: [{ rotate: '45deg' }], marginTop: -4 },
  todayButton: { minWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft, borderRadius: radii.md },
  todayText: { color: palette.primaryDark, fontSize: 12, fontWeight: typography.semibold },
  divider: { height: 0, marginBottom: 10 },
  viewport: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: 'hidden', height: 78 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, paddingHorizontal: 4, paddingVertical: 4 },
  dayButton: { flex: 1, alignItems: 'center', borderRadius: 18, minHeight: 70, paddingVertical: 6 },
  selectedDayButton: { backgroundColor: palette.primarySoft },
  weekday: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  selectedWeekday: { color: palette.primaryDark },
  sunday: { color: palette.primary },
  saturday: { color: '#47749E' },
  dateCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  dateNumber: { color: colors.text, fontSize: 18, fontWeight: '600' },
  selectedDateNumber: { color: palette.primaryDark, fontWeight: typography.semibold },
  todayDot: { width: 3, height: 3, borderRadius: 2, marginTop: 2 },
  todayDotVisible: { backgroundColor: palette.primary },
});
