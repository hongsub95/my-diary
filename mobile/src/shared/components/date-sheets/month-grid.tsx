import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { monthShape, toKey, WEEKDAYS } from './date-keys';

/** 칸 하나 높이. 누르기 쉬운 크기(44)를 지킨다. 기간 시트가 달 높이를 미리 계산할 때도 쓴다. */
export const CELL_HEIGHT = 44;
/** 요일 줄 높이 */
export const WEEKDAY_ROW_HEIGHT = 28;

const SATURDAY = '#47749E';

type MonthGridProps = {
  year: number;
  month: number;
  holidays: Map<string, string[]>;
  today: string;
  onPress: (key: string) => void;
  /** 하나만 고르는 시트의 고른 날 */
  selected?: string;
  /** 기간 시트의 시작·끝. 사이는 옅은 띠로 잇는다 */
  range?: { start: string; end: string };
  /** 칸 아래에 공휴일 이름을 작게 쓸지 */
  showHolidayNames?: boolean;
  /** 칸마다 덧붙일 표시(홈 월간 시트의 하루 상태 점) */
  renderExtra?: (key: string) => ReactNode;
  /** 요일 줄을 그릴지. 기간 시트는 달마다 다시 그린다 */
  showWeekdays?: boolean;
};

/**
 * 한 달 칸. 세 날짜 시트(하루·기간·홈 월간)가 같은 모양을 쓴다.
 *
 * 일요일·공휴일은 빨간 글씨, 토요일은 파란 글씨, 오늘은 테마 색 테두리, 고른 날은 테마 색
 * 바탕이다. 칸 이름에 공휴일 이름과 "오늘"을 함께 읽어 준다 — 색만으로는 전달되지 않는다.
 */
export function MonthGrid({ year, month, holidays, today, onPress, selected, range, showHolidayNames, renderExtra, showWeekdays = true }: MonthGridProps) {
  const s = useThemedStyles(createStyles);
  const { firstWeekday, length, rows } = monthShape(year, month);

  return (
    <View>
      {showWeekdays && (
        <View style={s.row}>
          {WEEKDAYS.map((name, i) => (
            <Text key={name} style={[s.weekday, i === 0 && s.sunday, i === 6 && s.saturday]}>{name}</Text>
          ))}
        </View>
      )}
      <View style={s.row}>
        {Array.from({ length: rows * 7 }, (_, i) => {
          const day = i - firstWeekday + 1;
          if (day < 1 || day > length) return <View key={i} style={s.cell} />;
          const key = toKey(year, month, day);
          const weekday = i % 7;
          const holiday = holidays.get(key);
          const isToday = key === today;
          const edge = range ? key === range.start || key === range.end : key === selected;
          const inside = range ? key > range.start && key < range.end : false;
          const single = range ? range.start === range.end : true;
          const label = `${year}년 ${month}월 ${day}일 ${WEEKDAYS[weekday]}요일${holiday ? `, ${holiday.join(', ')}` : ''}${isToday ? ', 오늘' : ''}`;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: edge }}
              onPress={() => onPress(key)}
              style={[
                s.cell,
                range && (inside || (edge && !single)) && s.band,
                range && edge && !single && key === range.start && s.bandStart,
                range && edge && !single && key === range.end && s.bandEnd,
              ]}>
              <View style={[s.number, isToday && s.today, edge && s.selected]}>
                <Text style={[
                  s.dayText,
                  (weekday === 0 || holiday) && s.sunday,
                  weekday === 6 && !holiday && s.saturday,
                  isToday && s.todayText,
                  edge && s.selectedText,
                ]}>{day}</Text>
              </View>
              {showHolidayNames && holiday && <Text numberOfLines={1} style={s.holidayName}>{holiday[0]}</Text>}
              {renderExtra?.(key)}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { color: colors.muted, fontSize: 12, height: WEEKDAY_ROW_HEIGHT, lineHeight: WEEKDAY_ROW_HEIGHT, textAlign: 'center', width: '14.2857%' },
  cell: { alignItems: 'center', height: CELL_HEIGHT, justifyContent: 'center', width: '14.2857%' },
  band: { backgroundColor: palette.primarySoft },
  bandStart: { borderBottomLeftRadius: 14, borderTopLeftRadius: 14 },
  bandEnd: { borderBottomRightRadius: 14, borderTopRightRadius: 14 },
  number: { alignItems: 'center', borderRadius: 12, height: 34, justifyContent: 'center', width: 34 },
  today: { borderColor: palette.primary, borderWidth: 1.5 },
  selected: { backgroundColor: palette.primary, borderWidth: 0 },
  dayText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  sunday: { color: colors.danger },
  saturday: { color: SATURDAY },
  todayText: { color: palette.primaryDark, fontWeight: '700' },
  selectedText: { color: '#FFFFFF', fontWeight: '700' },
  holidayName: { bottom: 1, color: colors.danger, fontSize: 8.5, position: 'absolute' },
});
