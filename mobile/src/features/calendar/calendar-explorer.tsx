import { useLayoutEffect, useRef, useState } from 'react';
import { Calendar } from 'react-native-calendars';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScheduleCard } from '@/features/schedules/schedule-card';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { PhaseTag, phaseColors, phaseKind, phaseKindLabels } from '@/features/schedules/phase-tag';
import { colors } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { dateKey, dateLabel, moveDate, parseDate, periodLabel, weekDates, type CalendarMode } from './calendar-dates';
import { DayAgenda } from './day-agenda';

const modes = [{ value: 'month', label: '월간' }, { value: 'week', label: '주간' }, { value: 'day', label: '일간' }] as const;
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const fillTheme = {
  'stylesheet.calendar.main': {
    monthView: { flex: 1 },
    week: { flex: 1, flexDirection: 'row', marginVertical: 0 },
  },
};
const noHeader = () => null;

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
  const kind = items.length ? phaseKind(items[0].experience_phase) : null;
  const tone = kind && phaseColors(kind, palette);
  const states = items.map(item => `${item.title} ${phaseKindLabels[phaseKind(item.experience_phase)]}`);
  return <Pressable accessibilityRole="button" accessibilityLabel={[dateLabel(day), ...states].join(', ')} onPress={onPress} style={[s.weekDate, selected && { backgroundColor: palette.primarySoft }]}>
    <Text style={s.muted}>{weekday}</Text>
    <Text style={s.dayNumber}>{Number(day.slice(8))}</Text>
    {/* 일정이 없어도 자리를 남겨 날짜 숫자 높이가 칸마다 흔들리지 않게 한다. */}
    <View style={[s.weekDot, tone && (kind === 'plan' ? { borderWidth: 1.5, borderColor: tone.dot } : { backgroundColor: tone.dot })]} />
  </Pressable>;
}

export function CalendarExplorer({ selectedDate, onSelect, onOpenDay, schedules, loading, failed, retry }: {
  selectedDate: string;
  onSelect: (date: string) => void;
  onOpenDay: (date: string) => void;
  schedules: Record<string, ScheduleView[]>;
  loading: boolean;
  failed: boolean;
  retry: () => void;
}) {
  const palette = useTheme();
  const [mode, setMode] = useState<CalendarMode>('month');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pager = useRef<ScrollView>(null);
  const moving = useRef(false);
  const [picker, setPicker] = useState(false);
  const [draft, setDraft] = useState(selectedDate);
  const [yearsOpen, setYearsOpen] = useState(false);
  const [yearPage, setYearPage] = useState(2020);
  const active = { backgroundColor: palette.primarySoft };
  const accent = { color: palette.primary };

  useLayoutEffect(() => {
    pager.current?.scrollTo({ x: size.width, animated: false });
    moving.current = false;
  }, [selectedDate, mode, size.width]);

  const move = (step: number) => {
    if (moving.current || !size.width) return;
    moving.current = true;
    pager.current?.scrollTo({ x: size.width * (1 + step), animated: true });
  };
  const openPicker = () => {
    setDraft(selectedDate);
    setYearPage(Math.floor(Number(selectedDate.slice(0, 4)) / 12) * 12);
    setYearsOpen(false);
    setPicker(true);
  };
  const setDraftMonth = (year: number, month: number) => {
    const day = Math.min(Number(draft.slice(8)), new Date(year, month, 0).getDate());
    setDraft(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  };
  const renderDay = (key: string, compact = false) => {
    const items = schedules[key] ?? [];
    return <View key={key} style={s.agendaDay}>
      {compact && <Pressable onPress={() => onSelect(key)} accessibilityRole="button"><Text style={[s.dayHeading, accent]}>{dateLabel(key)} ({weekdays[parseDate(key).getDay()]})</Text></Pressable>}
      {items.length ? items.map(item => <ScheduleCard key={item.id} schedule={item} />)
        : !loading && !failed && <Text style={s.empty}>이날은 일정이 없어요.</Text>}
    </View>;
  };

  return <View style={s.root}>
    <View style={s.top}><Text style={s.title}>캘린더</Text><Pressable accessibilityRole="button" onPress={() => onSelect(dateKey(new Date()))} style={s.button}><Text style={accent}>오늘</Text></Pressable></View>
    <View style={s.modes} accessibilityRole="tablist">{modes.map(item => <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: mode === item.value }} onPress={() => setMode(item.value)} style={[s.mode, mode === item.value && active]}><Text style={mode === item.value ? accent : s.muted}>{item.label}</Text></Pressable>)}</View>
    <View style={s.card}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="이전 기간" onPress={() => move(-1)} style={s.button}><Text style={s.arrow}>‹</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${periodLabel(selectedDate, mode)}, 날짜 이동 선택창 열기`} onPress={openPicker} style={s.dateButton}><Text style={s.dateTitle}>{periodLabel(selectedDate, mode)} ▾</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="다음 기간" onPress={() => move(1)} style={s.button}><Text style={s.arrow}>›</Text></Pressable>
      </View>
      {/* 일간은 그날 하루를 따로 조회하고 상태도 스스로 보여 준다(DayAgenda). 석 달치 조회 상태를 겹쳐 띄우지 않는다. */}
      {mode !== 'day' && loading && <Text accessibilityLiveRegion="polite" style={s.status}>일정을 불러오는 중…</Text>}
      {mode !== 'day' && failed && <Pressable accessibilityRole="button" onPress={retry}><Text style={s.status}>일정을 불러오지 못했어요. 다시 시도</Text></Pressable>}
      {mode === 'month' && <View style={s.weekStrip}>{weekdays.map(day => <Text key={day} style={[s.weekDate, s.muted, { textAlign: 'center' }]}>{day}</Text>)}</View>}
      <View style={s.viewport} onLayout={event => setSize(event.nativeEvent.layout)}>
        {size.width > 0 && size.height > 0 && <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: size.width, y: 0 }} onMomentumScrollEnd={event => {
          const step = Math.round(event.nativeEvent.contentOffset.x / size.width) - 1;
          moving.current = false;
          if (step) onSelect(moveDate(selectedDate, mode, step));
        }}>
          {[-1, 0, 1].map(step => {
            const key = moveDate(selectedDate, mode, step);
            const days = weekDates(key);
            return <View key={step} style={{ width: size.width, height: size.height }}>
              {mode === 'month' ? <Calendar key={key.slice(0, 7)} current={key} customHeader={noHeader} hideExtraDays firstDay={0} style={{ height: size.height }} theme={{ calendarBackground: colors.surface, ...fillTheme }} dayComponent={({ date }) => {
                if (!date) return null;
                const items = schedules[date.dateString] ?? [];
                // 칩 모양은 화면 읽기 도구에 전달되지 않으니 상태 이름을 라벨에 함께 읽어 준다.
                const states = items.map(item => `${item.title} ${phaseKindLabels[phaseKind(item.experience_phase)]}`);
                return <Pressable accessibilityRole="button" accessibilityLabel={[`${dateLabel(date.dateString)}, 일정 ${items.length}개`, ...states].join(', ')} onPress={() => onOpenDay(date.dateString)} style={[s.cell, selectedDate === date.dateString && active]}>
                  <Text style={[s.dayNumber, date.dateString === dateKey(new Date()) && accent]}>{date.day}</Text>
                  {items.slice(0, 2).map(item => <PhaseTag key={item.id} size="chip" label={item.title} kind={phaseKind(item.experience_phase)} />)}
                  {items.length > 2 && <Text style={s.more}>+{items.length - 2}</Text>}
                </Pressable>;
              }} /> : <View style={s.viewport}>
                {mode === 'week' && <View style={s.weekStrip}>{days.map((day, index) => <WeekDate key={day} day={day} weekday={weekdays[index]} items={schedules[day] ?? []} selected={selectedDate === day} onPress={() => onSelect(day)} />)}</View>}
                <ScrollView contentContainerStyle={s.agenda}>{mode === 'week' ? days.map(day => renderDay(day, true)) : <DayAgenda day={key} />}</ScrollView>
              </View>}
            </View>;
          })}
        </ScrollView>}
      </View>
      {mode === 'month' && <View style={s.legend}>
        {(['plan', 'pending', 'done'] as const).map(kind => <PhaseTag key={kind} size="chip" label={phaseKindLabels[kind]} kind={kind} />)}
      </View>}
    </View>
    <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
      <View style={s.modal}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="날짜 선택 취소" onPress={() => setPicker(false)} />
        <SafeAreaView edges={['bottom']} style={s.sheet}>
          <View style={s.top}><Text style={s.title}>{mode === 'month' ? '월 이동' : '날짜 이동'}</Text><Pressable style={s.button} accessibilityRole="button" onPress={() => setPicker(false)}><Text>취소</Text></Pressable></View>
          <ScrollView>
            <View style={s.header}>
              <Pressable style={s.button} accessibilityLabel="이전 연도 구간" onPress={() => yearsOpen ? setYearPage(yearPage - 12) : setDraftMonth(Number(draft.slice(0, 4)) - 1, Number(draft.slice(5, 7)))}><Text>‹</Text></Pressable>
              <Pressable style={s.dateButton} accessibilityRole="button" onPress={() => setYearsOpen(!yearsOpen)}><Text style={s.dateTitle}>{yearsOpen ? `${yearPage} ~ ${yearPage + 11}년` : `${draft.slice(0, 4)}년`} ▾</Text></Pressable>
              <Pressable style={s.button} accessibilityLabel="다음 연도 구간" onPress={() => yearsOpen ? setYearPage(yearPage + 12) : setDraftMonth(Number(draft.slice(0, 4)) + 1, Number(draft.slice(5, 7)))}><Text>›</Text></Pressable>
            </View>
            <View style={s.grid}>{Array.from({ length: 12 }, (_, index) => yearsOpen ? yearPage + index : index + 1).map(value => <Pressable key={value} accessibilityRole="button" style={[s.gridItem, value === Number(draft.slice(yearsOpen ? 0 : 5, yearsOpen ? 4 : 7)) && active]} onPress={() => {
              setDraftMonth(yearsOpen ? value : Number(draft.slice(0, 4)), yearsOpen ? Number(draft.slice(5, 7)) : value);
              if (yearsOpen) setYearsOpen(false);
            }}><Text>{value}{yearsOpen ? '년' : '월'}</Text></Pressable>)}</View>
            {mode !== 'month' && !yearsOpen && <Calendar key={draft.slice(0, 7)} current={draft} monthFormat="yyyy년 MM월" onMonthChange={date => setDraftMonth(date.year, date.month)} onDayPress={date => setDraft(date.dateString)} markedDates={{ [draft]: { selected: true, selectedColor: palette.primary } }} />}
            <Text style={s.status}>{periodLabel(draft, mode)}</Text>
          </ScrollView>
          <Pressable accessibilityRole="button" style={[s.apply, { backgroundColor: palette.primary }]} onPress={() => { onSelect(draft); setPicker(false); }}><Text style={s.applyText}>이동</Text></Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1 }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '600', color: colors.text }, muted: { color: colors.muted },
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  modes: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginVertical: 12 },
  mode: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
  dateButton: { flex: 1, minHeight: 44, justifyContent: 'center' }, dateTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center', color: colors.text },
  arrow: { fontSize: 24, color: colors.text }, viewport: { flex: 1 },
  cell: { flex: 1, width: '100%', padding: 2, borderRadius: 8 }, dayNumber: { textAlign: 'center', fontSize: 14, color: colors.text, marginVertical: 6 },
  more: { fontSize: 11, textAlign: 'center', color: colors.muted },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  weekStrip: { flexDirection: 'row', padding: 4 }, weekDate: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  weekDot: { width: 6, height: 6, borderRadius: 3, marginTop: -2 },
  agenda: { padding: 12, gap: 16 }, agendaDay: { gap: 8 }, dayHeading: { fontSize: 14, fontWeight: '600', paddingVertical: 8 }, empty: { color: colors.muted, paddingVertical: 16 },
  status: { padding: 8, textAlign: 'center', fontSize: 12, color: colors.muted },
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,25,23,0.35)' },
  sheet: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, gridItem: { width: '25%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  apply: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, applyText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
