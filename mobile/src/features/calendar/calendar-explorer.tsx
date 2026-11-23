import { useEffect, useMemo, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateSheet } from '@/shared/components/date-sheets/date-sheet';
import { ScheduleCard } from '@/features/schedules/schedule-card';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { phaseColors, phaseKind, phaseKindLabels } from '@/features/schedules/phase-tag';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { LoadingIndicator } from '@/shared/components/loading-indicator';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { dateKey, dateLabel, moveDate, parseDate, periodCount, periodIndex, periodLabel, periodStart, weekDates, type CalendarMode } from './calendar-dates';
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
  // 옆으로 넘기는 달력. 1900~2100년의 달(주·날)을 한 줄로 깔아 두고 화면 근처 장만 그린다.
  // 예전에는 앞·지금·다음 세 장만 두고, 넘길 때마다 세 장 내용을 바꾼 뒤 가운데로 되돌렸다.
  // 안드로이드에서는 되돌리기와 내용 바꾸기가 다른 프레임에 그려져 한순간 이전 달로 튀어
  // 버벅여 보였고, 끝 이벤트가 두 번 오면 두 달을 넘겼다. 한 줄로 깔면 되돌릴 일이 없다.
  const pager = useRef<FlatList<number>>(null);
  // 지금 화면에 멈춰 있는 장 번호. 같은 자리에서 끝 이벤트가 또 와도 다시 넘기지 않는다.
  const shown = useRef(-1);
  const target = periodIndex(selectedDate, mode);
  // 멀리 뛸 때마다 하나씩 늘려 장 줄을 그 자리에서 새로 깐다(아래 jumpTo).
  const [jump, setJump] = useState(0);
  const [picker, setPicker] = useState(false);
  const accent = { color: palette.primaryDark };

  // 고른 날이 옆 장으로 바뀌면(화살표) 그 장으로 밀어 옮긴다. 손으로 넘긴 경우는 이미 그 장에
  // 있어 아무것도 하지 않는다.
  useEffect(() => {
    if (!size.width || shown.current === target) return;
    const near = Math.abs(shown.current - target) === 1;
    shown.current = target;
    pager.current?.scrollToOffset({ offset: target * size.width, animated: near });
  }, [target, size.width]);

  const move = (step: number) => onSelect(moveDate(selectedDate, mode, step));
  // "오늘"·날짜 고르기처럼 멀리 뛸 때는 굴려 가지 않고 그 장에서 줄을 새로 깐다. 수십 장을 건너
  // 굴리면 사이 장을 그리느라 느리고, 웹에서는 장 맞춤(scroll snap)이 길을 잃고 첫 장으로 튄다.
  const jumpTo = (date: string) => {
    const index = periodIndex(date, mode);
    if (Math.abs(index - shown.current) > 1) {
      shown.current = index;
      setJump(count => count + 1);
    }
    onSelect(date);
  };
  // 장 번호 목록은 모드가 바뀔 때만 새로 만든다(일간은 7만 장이 넘는다).
  const items = useMemo(() => Array.from({ length: periodCount(mode) }, (_, index) => index), [mode]);
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
    <View style={s.top}><View style={s.heading}><View style={s.headingIcon}><SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={22} tintColor={palette.primaryDark} fallback={<Text style={accent}>▦</Text>} /></View><View style={s.headingCopy}><Text accessibilityRole="header" style={[s.title, dark && s.titleNight]}>캘린더</Text><Text style={[s.description, dark && s.descriptionNight]}>날짜마다 쌓이는 나의 하루.</Text></View></View><Pressable accessibilityRole="button" onPress={() => jumpTo(dateKey(new Date()))} style={s.todayButton}><Text style={s.todayText}>오늘</Text></Pressable></View>
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
        {size.width > 0 && size.height > 0 && <FlatList
          // 모드나 폭이 바뀌거나 멀리 뛰면 고른 날의 장부터 다시 깐다.
          key={`${mode}-${size.width}-${jump}`}
          ref={pager}
          data={items}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={String}
          getItemLayout={(_, index) => ({ length: size.width, offset: size.width * index, index })}
          initialScrollIndex={target}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          extraData={[schedules, selectedDate, loading, failed, size.height]}
          onMomentumScrollEnd={event => {
            const index = Math.round(event.nativeEvent.contentOffset.x / size.width);
            if (index === shown.current) return;
            // 처음 깔린 뒤 첫 이동이면 shown이 아직 비어 있다. 고른 날의 장에서 출발한 것으로 센다.
            const from = shown.current < 0 ? target : shown.current;
            shown.current = index;
            if (index !== from) onSelect(moveDate(selectedDate, mode, index - from));
          }}
          renderItem={({ index }) => {
            const key = periodStart(index, mode);
            const days = weekDates(key);
            const current = index === target;
            return <View style={{ width: size.width, height: size.height }} aria-hidden={!current} accessibilityElementsHidden={!current} importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}>
              {mode === 'month' ? <MonthEventGrid month={key} schedules={schedules} onOpenDay={onOpenDay} height={size.height} /> : <View style={s.viewport}>
                {mode === 'week' && <View style={s.weekStrip}>{days.map((day, dayIndex) => <WeekDate key={day} day={day} weekday={weekdays[dayIndex]} items={schedules[day] ?? []} selected={selectedDate === day} onPress={() => onSelect(day)} />)}</View>}
                <ScrollView contentContainerStyle={s.agenda}>{mode === 'week' ? days.map(day => renderDay(day, true)) : <DayAgenda day={key} />}</ScrollView>
              </View>}
            </View>;
          }}
        />}
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
    <DateSheet visible={picker} title={mode === 'month' ? '달 이동' : '날짜 이동'} value={selectedDate} mode={mode === 'month' ? 'month' : 'date'} onChange={jumpTo} onClose={() => setPicker(false)} />
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
