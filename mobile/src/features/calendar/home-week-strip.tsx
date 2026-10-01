import { useLayoutEffect, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { dateKey, moveDate, parseDate, weekDates } from './calendar-dates';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** CalendarExplorer와 같은 앞주·현재주·다음주 3페이지 스크롤 방식. */
export function HomeWeekStrip({ selectedDate, onSelect }: {
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme();
  const pager = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const weekStart = weekDates(selectedDate)[0];
  const today = dateKey(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState(selectedDate);
  const draftYear = Number(draft.slice(0, 4));
  const draftMonth = Number(draft.slice(5, 7));

  useLayoutEffect(() => {
    pager.current?.scrollTo({ x: width, animated: false });
  }, [weekStart, width]);

  const openPicker = () => {
    setDraft(selectedDate);
    setPickerOpen(true);
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
          accessibilityLabel={`${Number(selectedDate.slice(0, 4))}년 ${Number(selectedDate.slice(5, 7))}월, 월 선택 열기`}
          accessibilityState={{ expanded: pickerOpen }}
          onPress={openPicker}
          style={styles.monthButton}>
          <Text style={styles.monthTitle}>
            {Number(selectedDate.slice(0, 4))}년 {Number(selectedDate.slice(5, 7))}월
          </Text>
          <SymbolView
            name={{ ios: 'chevron.down', android: 'expand_more' }}
            size={18}
            tintColor={colors.muted}
            fallback={<View style={styles.chevronDown} />}
          />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onSelect(today)} style={styles.todayButton}>
          <Text style={styles.todayText}>오늘</Text>
        </Pressable>
      </View>
      <View style={styles.divider} />
      <View style={styles.viewport} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            directionalLockEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: width, y: 0 }}
            onMomentumScrollEnd={event => {
              const step = Math.max(-1, Math.min(1, Math.round(event.nativeEvent.contentOffset.x / width) - 1));
              if (step) onSelect(moveDate(selectedDate, 'week', step));
            }}>
            {[-1, 0, 1].map(step => (
              <View key={step} style={[styles.weekRow, { width }]} accessibilityElementsHidden={step !== 0} importantForAccessibility={step === 0 ? 'auto' : 'no-hide-descendants'}>
                {weekDates(moveDate(selectedDate, 'week', step)).map((key, index) => {
                  const date = parseDate(key);
                  const selected = key === selectedDate;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[index]}요일${key === today ? ', 오늘' : ''}`}
                      onPress={() => onSelect(key)}
                      style={styles.dayButton}>
                      <Text style={[styles.weekday, index === 0 && styles.sunday, index === 6 && styles.saturday]}>{WEEKDAYS[index]}</Text>
                      <View style={[styles.dateCircle, selected && styles.selectedDateCircle]}>
                        <Text style={[styles.dateNumber, selected && styles.selectedDateNumber]}>{date.getDate()}</Text>
                      </View>
                      <View style={[styles.todayDot, key === today && !selected && styles.todayDotVisible]} />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
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
            <Pressable accessibilityRole="button" style={[styles.apply, { backgroundColor: palette.primary }]} onPress={() => { onSelect(draft); setPickerOpen(false); }}>
              <Text style={styles.applyText}>{draftYear}년 {draftMonth}월로 이동</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  root: { zIndex: 3, backgroundColor: colors.surface, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5 },
  monthButton: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  monthTitle: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.4 },
  chevronDown: { width: 9, height: 9, borderBottomWidth: 2, borderRightWidth: 2, borderColor: colors.muted, transform: [{ rotate: '45deg' }], marginTop: -4 },
  todayButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  todayText: { color: palette.primaryDark, fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: 10 },
  viewport: { overflow: 'hidden', height: 58 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayButton: { flex: 1, alignItems: 'center', minHeight: 55 },
  weekday: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  sunday: { color: palette.primary },
  saturday: { color: '#47749E' },
  dateCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  selectedDateCircle: { backgroundColor: palette.primary },
  dateNumber: { color: colors.text, fontSize: 14, fontWeight: '600' },
  selectedDateNumber: { color: '#FFFFFF', fontWeight: '700' },
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
  monthText: { fontSize: 15, color: colors.text },
  activeMonthText: { color: palette.primaryDark, fontWeight: '700' },
  apply: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  applyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
