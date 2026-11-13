import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, typography, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { dateKey, moveDate, parseDate, weekDates } from './calendar-dates';

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
export function HomeWeekStrip({ selectedDate, onSelect }: {
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme();
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
  const [draft, setDraft] = useState(selectedDate);
  const draftYear = Number(draft.slice(0, 4));
  const draftMonth = Number(draft.slice(5, 7));
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

  const openPicker = () => {
    setDraft(visibleDate);
    setPickerOpen(true);
  };
  const selectDate = (key: string) => {
    showDate(key);
    onSelect(key);
  };
  const selectMonth = (month: number) => {
    // 31일 → 2월, 윤년 → 평년 이동은 공통 날짜 유틸의 말일 보정을 따른다.
    setDraft(moveDate(draft, 'month', month - draftMonth));
  };

  return (
    <View style={styles.root}>
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${Number(visibleDate.slice(0, 4))}년 ${Number(visibleDate.slice(5, 7))}월, 월 선택 열기`}
          accessibilityState={{ expanded: pickerOpen }}
          onPress={openPicker}
          style={styles.monthButton}>
          <Text style={styles.monthTitle}>
            {Number(visibleDate.slice(0, 4))}년 {Number(visibleDate.slice(5, 7))}월
          </Text>
          <SymbolView
            name={{ ios: 'chevron.down', android: 'expand_more' }}
            size={18}
            tintColor={colors.muted}
            fallback={<View style={styles.chevronDown} />}
          />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => selectDate(today)} style={styles.todayButton}>
          <Text style={styles.todayText}>오늘</Text>
        </Pressable>
      </View>
      <View style={styles.divider} />
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

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modal}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="월 선택 취소" onPress={() => setPickerOpen(false)} />
          <SafeAreaView edges={['bottom']} style={styles.picker} accessibilityViewIsModal>
            <View style={styles.pickerHeader}>
              <Text accessibilityRole="header" style={styles.monthTitle}>월 선택</Text>
              <Pressable accessibilityRole="button" style={styles.control} onPress={() => setPickerOpen(false)}><Text style={styles.muted}>취소</Text></Pressable>
            </View>
            <ScrollView bounces={false}>
              <View style={styles.yearRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="이전 연도" style={styles.control} onPress={() => setDraft(moveDate(draft, 'month', -12))}><Text style={styles.yearArrow}>‹</Text></Pressable>
                <Text accessibilityLiveRegion="polite" style={styles.monthTitle}>{draftYear}년</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="다음 연도" style={styles.control} onPress={() => setDraft(moveDate(draft, 'month', 12))}><Text style={styles.yearArrow}>›</Text></Pressable>
              </View>
              <View style={styles.monthGrid}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <Pressable key={month} accessibilityRole="button" accessibilityState={{ selected: month === draftMonth }} accessibilityLabel={`${draftYear}년 ${month}월`} style={[styles.monthCell, month === draftMonth && styles.activeMonth]} onPress={() => selectMonth(month)}>
                    <Text style={[styles.monthText, month === draftMonth && styles.activeMonthText]}>{month}월</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Pressable accessibilityRole="button" style={[styles.apply, { backgroundColor: palette.primary }]} onPress={() => { showDate(draft); setPickerOpen(false); }}>
              <Text style={styles.applyText}>{draftYear}년 {draftMonth}월로 이동</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  root: { zIndex: 3, backgroundColor: colors.background, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
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
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,25,23,0.35)' },
  picker: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  control: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.muted },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  yearArrow: { color: colors.text, fontSize: 26 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  monthCell: { width: '25%', minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  activeMonth: { backgroundColor: palette.primarySoft },
  monthText: { fontSize: typography.body, color: colors.text },
  activeMonthText: { color: palette.primaryDark, fontWeight: typography.semibold },
  apply: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  applyText: { color: '#FFFFFF', fontSize: typography.body, fontWeight: typography.semibold },
});
