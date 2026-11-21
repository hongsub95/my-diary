import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { BottomSheet } from './bottom-sheet';
import { dayLabel, daysInclusive, monthShape, parseKey, shiftMonth, todayKey } from './date-keys';
import { CELL_HEIGHT, MonthGrid, WEEKDAY_ROW_HEIGHT } from './month-grid';
import { useHolidays } from './use-holidays';

type Range = { start: string; end: string };

type RangeSheetProps = {
  visible: boolean;
  start: string;
  end: string;
  onApply: (range: Range) => void;
  onClose: () => void;
  /** 위쪽 요약 줄 문구. 없으면 "12월 24일 (목) ~ 12월 26일 (토) · 3일" */
  describe?: (range: Range) => string;
};

/** 목록에 담을 달: 시작일 앞 12달부터 뒤 24달까지. 지난 하루를 기록용으로 만들 때도 닿게 앞쪽도 둔다. */
const MONTHS_BEFORE = 12;
const MONTHS_AFTER = 24;
const MONTH_TITLE_HEIGHT = 44;

/**
 * 여러 날 하루의 기간 고르기 시트 (시안 B, 유아이볼 "트립스토어"·"수현이랑" 참고).
 *
 * 첫 탭이 시작, 두 번째 탭이 끝이다. 시작만 고른 채로 적용하면 하루짜리가 된다 — 대부분의
 * 하루는 하루짜리라서, 같은 날을 두 번 누르게 하지 않는다. 끝을 시작보다 앞으로 누르면
 * 그 날을 새 시작으로 본다.
 *
 * 달은 세로로 이어진다. 몇 달 뒤 여행도 넘기기 버튼 없이 쭉 내려서 고르고, 기간이 달을
 * 넘어가도 한눈에 보인다. 위쪽 요약 줄에 고른 기간과 며칠인지를 늘 보여준다.
 */
export function RangeSheet(props: RangeSheetProps) {
  // 본문은 열 때마다 새로 만들어 지금 값에서 시작한다.
  return (
    <BottomSheet visible={props.visible} onClose={props.onClose} label="기간 고르기" heightRatio={0.86}>
      <RangeSheetBody {...props} />
    </BottomSheet>
  );
}

function RangeSheetBody({ start, end, onApply, onClose, describe }: RangeSheetProps) {
  const s = useThemedStyles(createStyles);
  const today = todayKey();
  const initialStart = start || today;
  const [period, setPeriod] = useState<Range>({ start: initialStart, end: end && end >= initialStart ? end : initialStart });
  // 시작만 고르고 끝을 기다리는 중인지. 처음 열 때는 기존 기간이 그대로 보이게 기다리지 않는다.
  const [awaitingEnd, setAwaitingEnd] = useState(false);

  const anchor = parseKey(initialStart);
  const months = useMemo(() => Array.from({ length: MONTHS_BEFORE + MONTHS_AFTER + 1 }, (_, i) => shiftMonth(anchor.year, anchor.month, i - MONTHS_BEFORE)), [anchor.year, anchor.month]);
  // 달마다 줄 수가 달라(4~6줄) 높이를 미리 계산한다. 그래야 처음부터 시작일이 있는 달로 바로 내려간다.
  const layouts = useMemo(() => {
    let offset = 0;
    return months.map(({ year, month }) => {
      const length = MONTH_TITLE_HEIGHT + WEEKDAY_ROW_HEIGHT + monthShape(year, month).rows * CELL_HEIGHT;
      const layout = { length, offset };
      offset += length;
      return layout;
    });
  }, [months]);
  const holidays = useHolidays(months.map(m => m.year));
  const list = useRef<FlatList<{ year: number; month: number }>>(null);
  const placed = useRef(false);

  const press = (key: string) => {
    if (!awaitingEnd || key < period.start) {
      setPeriod({ start: key, end: key });
      setAwaitingEnd(true);
      return;
    }
    setPeriod({ start: period.start, end: key });
    setAwaitingEnd(false);
  };

  const days = daysInclusive(period.start, period.end);
  const summary = describe ? describe(period) : days === 1 ? `${dayLabel(period.start)} · 하루` : `${dayLabel(period.start)} ~ ${dayLabel(period.end)} · ${days}일`;

  return (
    <View style={s.body}>
      <Text accessibilityRole="header" style={s.title}>기간</Text>
      <View style={s.summary} accessibilityLiveRegion="polite">
        <Text style={s.summaryText}>{summary}</Text>
        {awaitingEnd && <Text style={s.summaryHint}>끝나는 날을 누르거나, 하루만이면 바로 적용하세요</Text>}
      </View>

      <FlatList
        style={s.list}
        data={months}
        keyExtractor={({ year, month }) => `${year}-${month}`}
        ref={list}
        initialScrollIndex={MONTHS_BEFORE}
        getItemLayout={(_, index) => ({ ...layouts[index], index })}
        // 웹(react-native-web)은 initialScrollIndex를 무시해서, 목록이 처음 자리 잡을 때 시작일의
        // 달로 직접 옮긴다. 두 번째부터는 사용자가 내린 자리를 건드리지 않는다.
        onLayout={() => {
          if (placed.current) return;
          placed.current = true;
          list.current?.scrollToOffset({ offset: layouts[MONTHS_BEFORE].offset, animated: false });
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View>
            <Text style={s.monthTitle}>{item.year}년 {item.month}월</Text>
            <MonthGrid year={item.year} month={item.month} holidays={holidays} today={today} range={period} showHolidayNames onPress={press} />
          </View>
        )}
      />

      <View style={s.actions}>
        <Pressable accessibilityRole="button" onPress={() => { setPeriod({ start: today, end: today }); setAwaitingEnd(true); }} style={s.reset}>
          <Text style={s.resetText}>초기화</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${summary} 적용하기`} onPress={() => { onApply(period); onClose(); }} style={s.apply}>
          <Text style={s.applyText}>적용하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  body: { flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  summary: { backgroundColor: colors.surfaceMuted, borderRadius: 14, gap: 2, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10 },
  summaryText: { color: palette.primaryDark, fontSize: 13, fontWeight: '700' },
  summaryHint: { color: colors.muted, fontSize: 12 },
  list: { flex: 1, marginTop: 4 },
  monthTitle: { color: colors.text, fontSize: 15, fontWeight: '700', height: MONTH_TITLE_HEIGHT, lineHeight: MONTH_TITLE_HEIGHT, paddingHorizontal: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  reset: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 16, justifyContent: 'center', minHeight: 50, paddingHorizontal: 18 },
  resetText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  apply: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 16, flex: 1, justifyContent: 'center', minHeight: 50 },
  applyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
