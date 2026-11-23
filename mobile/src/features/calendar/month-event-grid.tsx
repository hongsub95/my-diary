import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { phaseKind, phaseKindLabels, type PhaseKind } from '@/features/schedules/phase-tag';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { monthShape, parseKey, toKey, todayKey, WEEKDAYS } from '@/shared/components/date-sheets/date-keys';
import { useHolidays } from '@/shared/components/date-sheets/use-holidays';
import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { seoulDateKey } from '@/shared/utils/date';

type MonthEventGridProps = {
  /** 보여줄 달 안의 아무 날('YYYY-MM-DD') */
  month: string;
  /** 날짜별 하루. 여러 날 하루는 걸친 날마다 들어 있다(CalendarScreen이 묶어 준다) */
  schedules: Record<string, ScheduleView[]>;
  selectedDate: string;
  /** 날짜를 누르면 그날 서랍을 연다 */
  onOpenDay: (date: string) => void;
  /** 달력에 쓸 수 있는 높이. 주 줄 높이와 막대 줄 수를 여기서 정한다 */
  height: number;
};

/** 날짜 숫자 줄 높이. 막대는 그 아래부터 쌓는다. */
const NUMBER_ROW = 26;
const BAR_HEIGHT = 17;
const BAR_GAP = 2;
const MAX_LANES = 3;

type Bar = { id: number; title: string; kind: PhaseKind; startCol: number; span: number; lane: number; continuesLeft: boolean; continuesRight: boolean };

/**
 * 캘린더 탭 월간 보기 (2026-11-23 시안 "A + C ① 고정형"에서 아래 목록을 뺀 모양).
 *
 * 하루를 칸마다 칩으로 넣던 방식은 칸이 좁아 이름이 잘리고 여러 날 하루가 날마다 따로
 * 보였다. 그래서 주마다 한 줄씩 그리고, 그 위에 하루를 막대로 겹쳐 그린다. 여러 날 하루는
 * 이어진 막대 하나이고, 주가 바뀌면 다음 줄에서 이어진다(끊긴 쪽은 모서리를 각지게 둔다).
 *
 * 막대 줄 수는 칸 높이로 정한다(최대 3줄). 넘치는 하루가 있는 날은 숫자 오른쪽 위에 "+N".
 * 날짜를 누르면 지금처럼 그날 서랍이 열린다.
 *
 * 오늘은 배경·테두리 없이 숫자만 테마 색으로 굵게. 고른 날 바탕은 두지 않는다 — 날짜를 누르면
 * 바로 서랍이 열려 어느 날인지 보이고, 처음 열면 오늘이 골라져 있어 오늘 칸에 바탕이 깔리기 때문이다.
 */
export function MonthEventGrid({ month, schedules, selectedDate, onOpenDay, height }: MonthEventGridProps) {
  const s = useThemedStyles(createStyles);
  const { year, month: monthNumber } = parseKey(month);
  const { firstWeekday, length, rows } = monthShape(year, monthNumber);
  const holidays = useHolidays([year]);
  const today = todayKey();
  const rowHeight = Math.floor(height / rows);
  const lanes = Math.max(1, Math.min(MAX_LANES, Math.floor((rowHeight - NUMBER_ROW - 4) / (BAR_HEIGHT + BAR_GAP))));

  // 달에 걸친 하루를 한 번씩만 모은다. 날짜별 묶음에는 여러 날 하루가 날마다 들어 있다.
  const events = useMemo(() => {
    const byId = new Map<number, ScheduleView>();
    for (const list of Object.values(schedules)) for (const item of list) byId.set(item.id, item);
    return [...byId.values()].map(item => ({ item, start: item.dateKey, end: seoulDateKey(item.end_at) }));
  }, [schedules]);

  const weeks = useMemo(() => Array.from({ length: rows }, (_, w) => {
    const firstDay = w * 7 - firstWeekday + 1;
    const rowFirst = toKey(year, monthNumber, Math.max(1, firstDay));
    const rowLast = toKey(year, monthNumber, Math.min(length, firstDay + 6));
    const laneEnds: number[] = [];
    const hidden = new Map<number, number>();
    const bars: Bar[] = [];
    events
      .filter(e => e.start <= rowLast && e.end >= rowFirst)
      // 먼저 시작하고 길게 이어지는 하루를 위 줄에 둔다. 그래야 막대가 줄을 바꾸지 않는다.
      .sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end) || a.item.id - b.item.id)
      .forEach(e => {
        const startDay = e.start < rowFirst ? parseKey(rowFirst).day : parseKey(e.start).day;
        const endDay = e.end > rowLast ? parseKey(rowLast).day : parseKey(e.end).day;
        let lane = laneEnds.findIndex(end => end < startDay);
        if (lane < 0) { lane = laneEnds.length; laneEnds.push(0); }
        laneEnds[lane] = endDay;
        if (lane >= lanes) {
          for (let d = startDay; d <= endDay; d++) hidden.set(d, (hidden.get(d) ?? 0) + 1);
          return;
        }
        bars.push({
          id: e.item.id, title: e.item.title, kind: phaseKind(e.item.experience_phase), lane,
          startCol: startDay - firstDay, span: endDay - startDay + 1,
          continuesLeft: e.start < rowFirst, continuesRight: e.end > rowLast,
        });
      });
    return { firstDay, bars, hidden };
  }), [events, firstWeekday, lanes, length, monthNumber, rows, year]);

  return (
    <View>
      {weeks.map(({ firstDay, bars, hidden }, w) => (
        <View key={w} style={[s.week, { height: rowHeight }, w > 0 && s.weekDivider]}>
          {Array.from({ length: 7 }, (_, col) => {
            const day = firstDay + col;
            if (day < 1 || day > length) return <View key={col} style={s.cell} />;
            const key = toKey(year, monthNumber, day);
            const items = schedules[key] ?? [];
            const holiday = holidays.get(key);
            const isToday = key === today;
            const selected = key === selectedDate;
            // 막대 모양은 화면 읽기 도구에 전달되지 않으니 하루 이름과 상태를 칸 이름에 함께 읽어 준다.
            const label = [
              `${monthNumber}월 ${day}일 ${WEEKDAYS[col]}요일${holiday ? `, ${holiday.join(', ')}` : ''}${isToday ? ', 오늘' : ''}`,
              `하루 ${items.length}개`,
              ...items.map(item => `${item.title} ${phaseKindLabels[phaseKind(item.experience_phase)]}`),
              ...(selected ? ['선택됨'] : []),
            ].join(', ');
            return (
              <Pressable
                key={col}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                onPress={() => onOpenDay(key)}
                style={s.cell}>
                <Text style={[
                  s.number,
                  (col === 0 || holiday) && s.sunday,
                  col === 6 && !holiday && s.saturday,
                  isToday && s.today,
                ]}>{day}</Text>
                {(hidden.get(day) ?? 0) > 0 && <Text style={s.more}>+{hidden.get(day)}</Text>}
              </Pressable>
            );
          })}
          <View pointerEvents="none" style={s.bars}>
            {bars.map(bar => (
              <View
                key={`${bar.id}-${w}`}
                style={[
                  s.bar,
                  s[bar.kind],
                  {
                    left: `${(bar.startCol / 7) * 100}%`,
                    width: `${(bar.span / 7) * 100}%`,
                    top: NUMBER_ROW + bar.lane * (BAR_HEIGHT + BAR_GAP),
                  },
                  bar.continuesLeft && s.openLeft,
                  bar.continuesRight && s.openRight,
                ]}>
                <Text numberOfLines={1} style={[s.barText, s[`${bar.kind}Text`]]}>{bar.title}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  week: { flexDirection: 'row' },
  weekDivider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  cell: { alignItems: 'center', borderRadius: 12, flex: 1, paddingTop: 5 },
  number: { color: colors.text, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  sunday: { color: colors.danger },
  saturday: { color: '#47749E' },
  // 오늘: 배경·테두리 없이 숫자만 테마 색으로 굵게
  today: { color: palette.primary, fontWeight: '800' },
  more: { backgroundColor: colors.surfaceMuted, borderRadius: 6, color: colors.muted, fontSize: 9, fontWeight: '700', lineHeight: 14, overflow: 'hidden', paddingHorizontal: 3, position: 'absolute', right: 2, top: 4 },
  bars: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  bar: { borderRadius: 5, height: BAR_HEIGHT, justifyContent: 'center', marginHorizontal: 2, paddingLeft: 6, paddingRight: 3, position: 'absolute' },
  // 다른 주로 이어지는 쪽은 모서리를 각지게 해서 "이어진다"는 것을 보여준다.
  openLeft: { borderBottomLeftRadius: 0, borderTopLeftRadius: 0, marginLeft: 0 },
  openRight: { borderBottomRightRadius: 0, borderTopRightRadius: 0, marginRight: 0 },
  barText: { fontSize: 10, fontWeight: '700' },
  plan: { backgroundColor: palette.primarySoft, borderLeftColor: palette.primary, borderLeftWidth: 3 },
  pending: { backgroundColor: colors.orangeSoft, borderLeftColor: colors.orange, borderLeftWidth: 3 },
  done: { backgroundColor: '#E6ECE4', borderLeftColor: colors.sage, borderLeftWidth: 3 },
  planText: { color: palette.primaryDark },
  pendingText: { color: colors.orangeDark },
  doneText: { color: '#45573F' },
});
