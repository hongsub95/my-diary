import { useLayoutEffect, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateSheet } from '@/shared/components/date-sheets/date-sheet';
import { ScheduleCard } from '@/features/schedules/schedule-card';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { phaseColors, phaseKind, phaseKindLabels } from '@/features/schedules/phase-tag';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { LoadingIndicator } from '@/shared/components/loading-indicator';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { dateKey, dateLabel, moveDate, parseDate, periodLabel, weekDates, type CalendarMode } from './calendar-dates';
import { DayAgenda } from './day-agenda';
import { MonthEventGrid } from './month-event-grid';
import { DownChevron } from '@/shared/components/down-chevron';
import { NIGHT_TEXT, NIGHT_TEXT_SHADOW } from '@/features/seasonal/scene-colors';
import { SnowCapped } from '@/features/seasonal/snow-cap';

const modes = [{ value: 'month', label: '월간' }, { value: 'week', label: '주간' }, { value: 'day', label: '일간' }] as const;
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 주간 보기 위쪽 날짜 줄의 날짜 하나. 날짜 아래 점으로 그날 첫 하루의 상태를 보여 준다.
 * 점은 작아서 모양으로 나누기 어렵다. 예정은 속 빈 고리, 나머지는 채운 점으로만 구분하고,
 * 정확한 상태는 아래 카드 배지와 화면 읽기 라벨이 전한다.
 *
 * @param day 'YYYY-MM-DD'
 * @param weekday 요일 한 글자
 * @param items 그날 걸친 일정 (시작 시간 순)
 * @param selected 지금 고른 날짜인지
 * @param onPress 날짜를 눌렀을 때
 */
function WeekDate({ day, weekday, items, selected, onPress }: { day: string; weekday: string; items: ScheduleView[]; selected: boolean; onPress: () => void }) {
  const palette = useTheme();
  const s = useThemedStyles(createStyles);
  const kind = items.length ? phaseKind(items[0].experience_phase) : null;
  const tone = kind && phaseColors(kind, palette);
  const states = items.map(item => `${item.title} ${phaseKindLabels[phaseKind(item.experience_phase)]}`);
  return <Pressable accessibilityRole="button" accessibilityLabel={[dateLabel(day), ...states, ...(selected ? ['선택됨'] : [])].join(', ')} accessibilityState={{ selected }} onPress={onPress} style={[s.weekDate, selected && s.selectedWeekDate]}>
    <Text style={s.muted}>{weekday}</Text>
    <Text style={[s.dayNumber, selected && s.selectedDateText]}>{Number(day.slice(8))}</Text>
    {/* 일정이 없어도 자리를 남겨 날짜 숫자 높이가 칸마다 흔들리지 않게 한다. */}
    <View style={[s.weekDot, tone && (kind === 'plan' ? { borderWidth: 1.5, borderColor: tone.dot } : { backgroundColor: tone.dot })]} />
  </Pressable>;
}

export function CalendarExplorer({ selectedDate, onSelect, onOpenDay, schedules, loading, failed, retry, seasonal }: {
  selectedDate: string;
  onSelect: (date: string) => void;
  onOpenDay: (date: string) => void;
  schedules: Record<string, ScheduleView[]>;
  loading: boolean;
  failed: boolean;
  retry: () => void;
  /** 계절 배경. full이면 달력 카드 위에 눈을 얹고, onDarkSky면 카드 밖 제목·설명을 밤 색으로 */
  seasonal?: { full: boolean; night: boolean; onDarkSky: boolean };
}) {
  const palette = useTheme();
  const dark = seasonal?.onDarkSky ?? false;
  const s = useThemedStyles(createStyles);
  const [mode, setMode] = useState<CalendarMode>('month');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pager = useRef<ScrollView>(null);
  const moving = useRef(false);
  // 한 번 민 것으로 이미 달을 넘겼다는 표시. 안드로이드는 한 번 튕겨도 끝 이벤트를 두 번 보낼 때가 있고,
  // 두 번째는 가운데로 되돌리기 전 위치(옆 장)를 담고 있어 그대로 두면 한 달을 더 넘긴다.
  // 다음에 손가락을 대거나 화살표를 누를 때 풀린다.
  const settled = useRef(false);
  const [picker, setPicker] = useState(false);
  const accent = { color: palette.primaryDark };

  useLayoutEffect(() => {
    pager.current?.scrollTo({ x: size.width, animated: false });
    moving.current = false;
  }, [selectedDate, mode, size.width]);

  const move = (step: number) => {
    if (moving.current || !size.width) return;
    moving.current = true;
    settled.current = false;
    pager.current?.scrollTo({ x: size.width * (1 + step), animated: true });
  };
  const openPicker = () => setPicker(true);
  const renderDay = (key: string, compact = false) => {
    const items = schedules[key] ?? [];
    return <View key={key} style={s.agendaDay}>
      {compact && <Pressable onPress={() => onSelect(key)} accessibilityRole="button"><Text style={[s.dayHeading, accent]}>{dateLabel(key)} ({weekdays[parseDate(key).getDay()]})</Text></Pressable>}
      {items.length ? items.map(item => <ScheduleCard key={item.id} schedule={item} />)
        : !loading && !failed && <Text style={s.empty}>이날은 일정이 없어요.</Text>}
    </View>;
  };

  return <View style={s.root}>
    <View style={s.top}><View style={s.heading}><View style={s.headingIcon}><SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={22} tintColor={palette.primaryDark} fallback={<Text style={accent}>▦</Text>} /></View><View style={s.headingCopy}><Text accessibilityRole="header" style={[s.title, dark && s.titleNight]}>캘린더</Text><Text style={[s.description, dark && s.descriptionNight]}>날짜마다 쌓이는 나의 하루.</Text></View></View><Pressable accessibilityRole="button" onPress={() => onSelect(dateKey(new Date()))} style={s.todayButton}><Text style={s.todayText}>오늘</Text></Pressable></View>
    <View style={s.modes} accessibilityRole="tablist">{modes.map(item => <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: mode === item.value }} aria-selected={mode === item.value} onPress={() => setMode(item.value)} style={[s.mode, mode === item.value && s.modeActive]}><Text style={[s.modeLabel, mode === item.value && accent]}>{item.label}</Text></Pressable>)}</View>
    <SnowCapped show={seasonal?.full ?? false} night={seasonal?.night ?? false} style={s.cardWrap}>
    <View style={s.card}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 기간" onPress={() => move(-1)} style={s.button}><Text style={s.arrow}>‹</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${periodLabel(selectedDate, mode)}, 날짜 이동 선택창 열기`} onPress={openPicker} style={s.dateButton}><Text style={s.dateTitle}>{periodLabel(selectedDate, mode)}</Text><DownChevron /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 기간" onPress={() => move(1)} style={s.button}><Text style={s.arrow}>›</Text></Pressable>
      </View>
      {/* 일간은 그날 하루를 따로 조회하고 상태도 스스로 보여 준다(DayAgenda). 석 달치 조회 상태를 겹쳐 띄우지 않는다. */}
      {mode !== 'day' && loading && <View style={s.loading}><LoadingIndicator message="일정을 불러오고 있어요." /></View>}
      {mode !== 'day' && failed && <Pressable accessibilityRole="button" onPress={retry}><Text style={s.status}>일정을 불러오지 못했어요. 다시 시도</Text></Pressable>}
      {mode === 'month' && <View style={s.weekStrip}>{weekdays.map(day => <Text key={day} style={s.weekdayLabel}>{day}</Text>)}</View>}
      <View style={s.viewport} onLayout={event => setSize(event.nativeEvent.layout)}>
        {size.width > 0 && size.height > 0 && <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: size.width, y: 0 }} onScrollBeginDrag={() => { settled.current = false; }} onMomentumScrollEnd={event => {
          const step = Math.round(event.nativeEvent.contentOffset.x / size.width) - 1;
          moving.current = false;
          if (!step || settled.current) return;
          settled.current = true;
          onSelect(moveDate(selectedDate, mode, step));
        }}>
          {[-1, 0, 1].map(step => {
            const key = moveDate(selectedDate, mode, step);
            const days = weekDates(key);
            // 장마다 달(주·날)로 이름을 붙인다. 자리(왼쪽·가운데·오른쪽)로 붙이면 달을 넘길 때 세 장을
            // 모두 새 달로 다시 그린다. 달로 붙이면 이미 그린 장은 자리만 옮기고 새로 생긴 한 장만 그린다.
            const period = mode === 'month' ? key.slice(0, 7) : mode === 'week' ? days[0] : key;
            return <View key={period} style={{ width: size.width, height: size.height }} aria-hidden={step !== 0} accessibilityElementsHidden={step !== 0} importantForAccessibility={step === 0 ? 'auto' : 'no-hide-descendants'}>
              {mode === 'month' ? <MonthEventGrid month={key} schedules={schedules} onOpenDay={onOpenDay} height={size.height} /> : <View style={s.viewport}>
                {mode === 'week' && <View style={s.weekStrip}>{days.map((day, index) => <WeekDate key={day} day={day} weekday={weekdays[index]} items={schedules[day] ?? []} selected={selectedDate === day} onPress={() => onSelect(day)} />)}</View>}
                <ScrollView contentContainerStyle={s.agenda}>{mode === 'week' ? days.map(day => renderDay(day, true)) : <DayAgenda day={key} />}</ScrollView>
              </View>}
            </View>;
          })}
        </ScrollView>}
      </View>
      {mode === 'month' && <View style={s.legend}>
        {(['plan', 'pending', 'done'] as const).map(kind => {
          const tone = phaseColors(kind, palette);
          // 범례는 달력 막대와 같은 모양(옅은 바탕 + 왼쪽 색 줄)으로 그린다.
          return <View key={kind} style={s.legendItem}><View style={[s.legendBar, { backgroundColor: kind === 'done' ? '#E6ECE4' : tone.background === colors.surface ? palette.primarySoft : tone.background, borderLeftColor: tone.dot }]} /><Text style={s.legendLabel}>{phaseKindLabels[kind]}</Text></View>;
        })}
      </View>}
    </View>
    </SnowCapped>
    <DateSheet visible={picker} title={mode === 'month' ? '달 이동' : '날짜 이동'} value={selectedDate} mode={mode === 'month' ? 'month' : 'date'} onChange={onSelect} onClose={() => setPicker(false)} />
  </View>;
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headingIcon: { alignItems: 'center', backgroundColor: palette.primarySoft, borderRadius: radii.lg, height: 48, justifyContent: 'center', width: 48 },
  headingCopy: { flex: 1 },
  title: { fontSize: typography.heading, fontWeight: typography.semibold, color: colors.text },
  description: { color: colors.muted, fontSize: typography.body, lineHeight: 22, marginTop: spacing.xs },
  titleNight: { color: NIGHT_TEXT.strong, ...NIGHT_TEXT_SHADOW },
  descriptionNight: { color: NIGHT_TEXT.muted, ...NIGHT_TEXT_SHADOW },
  // 달력 카드는 남은 높이를 채운다. 눈을 얹는 틀도 같이 채워야 카드가 줄어들지 않는다.
  cardWrap: { flex: 1 },
  muted: { color: colors.muted, fontSize: typography.body },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  todayButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderRadius: radii.full, paddingHorizontal: spacing.md },
  todayText: { color: palette.primaryDark, fontSize: typography.body, fontWeight: typography.semibold },
  modes: { flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radii.lg, padding: spacing.xs, marginVertical: spacing.lg },
  mode: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, paddingVertical: spacing.sm },
  modeActive: { backgroundColor: colors.surface },
  modeLabel: { color: colors.muted, fontSize: typography.body, fontWeight: typography.semibold },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: spacing.xs },
  // 제목과 화살표를 한 줄에 두고 위아래 가운데를 맞춘다.
  dateButton: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 4, justifyContent: 'center', minHeight: 44 },
  dateTitle: { fontSize: typography.emphasis, fontWeight: typography.semibold, textAlign: 'center', color: colors.text },
  arrow: { fontSize: 24, color: colors.muted },
  viewport: { flex: 1 },
  stateMarker: { width: 6, height: 6, borderRadius: 3 },
  pendingMarker: { borderRadius: 1 },
  legendBar: { borderLeftWidth: 3, borderRadius: 3, height: 10, width: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendLabel: { color: colors.muted, fontSize: 12 },
  dayNumber: { textAlign: 'center', fontSize: typography.body, color: colors.text, marginVertical: spacing.xs },
  selectedDateText: { color: palette.primaryDark, fontWeight: typography.semibold },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  weekStrip: { flexDirection: 'row', padding: spacing.xs },
  weekdayLabel: { flex: 1, color: colors.muted, fontSize: 12, paddingVertical: spacing.sm, textAlign: 'center' },
  weekDate: { flex: 1, alignItems: 'center', minHeight: 76, paddingVertical: spacing.sm, borderRadius: radii.md },
  selectedWeekDate: { backgroundColor: palette.primarySoft },
  weekDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  agenda: { padding: spacing.md, gap: spacing.lg },
  agendaDay: { gap: spacing.sm },
  dayHeading: { fontSize: typography.body, fontWeight: typography.semibold, minHeight: 44, paddingVertical: spacing.md },
  empty: { color: colors.muted, fontSize: typography.body, lineHeight: 22, padding: spacing.lg, backgroundColor: colors.surfaceMuted, borderRadius: radii.lg },
  loading: { alignItems: 'center', paddingVertical: spacing.sm },
  status: { minHeight: 44, padding: spacing.sm, textAlign: 'center', fontSize: typography.body, lineHeight: 22, color: colors.muted },
});
