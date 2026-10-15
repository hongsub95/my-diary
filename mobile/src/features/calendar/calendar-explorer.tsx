import { useLayoutEffect, useRef, useState } from 'react';
import { Calendar } from 'react-native-calendars';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScheduleCard } from '@/features/schedules/schedule-card';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { colors, type ThemePalette } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { dateKey, dateLabel, moveDate, parseDate, periodLabel, weekDates, type CalendarMode } from './calendar-dates';

const modes = [{ value: 'month', label: '월간' }, { value: 'week', label: '주간' }, { value: 'day', label: '일간' }] as const;
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const fillTheme = {
  'stylesheet.calendar.main': {
    monthView: { flex: 1 },
    week: { flex: 1, flexDirection: 'row', marginVertical: 0 },
  },
};
const noHeader = () => null;

type ChipKind = 'plan' | 'pending' | 'done';
const chipLabels: Record<ChipKind, string> = { plan: '예정', pending: '남기기 전', done: '남긴 하루' };

/**
 * 서버가 계산한 experience_phase를 칩 모양 세 가지로 묶는다 (CALENDAR_SCREEN_SPEC 2026-10-15).
 *
 * @param phase 일정 응답의 experience_phase
 * @returns 예정(plan) · 남기기 전(pending) · 남긴 하루(done)
 */
function chipKind(phase: string): ChipKind {
  if (phase === 'recorded') return 'done';
  if (phase === 'record_pending') return 'pending';
  // upcoming·today가 예정이다. canceled는 노출 여부가 아직 열린 결정이라 이전처럼 예정 모양으로 둔다.
  return 'plan';
}

/**
 * 월간 날짜 칸과 범례에 쓰는 상태 칩.
 * 색을 구분하기 어려운 사람도 알아보게 모양을 달리한다: 예정은 테두리만, 남기기 전은 주황 점,
 * 남긴 하루는 채운 바탕에 체크.
 *
 * @param label 칩에 쓸 글자 (하루 제목 또는 범례 이름)
 * @param kind 칩 모양
 * @param palette 사용자가 고른 테마. 예정 칩만 테마 색을 따른다
 */
function PhaseChip({ label, kind, palette }: { label: string; kind: ChipKind; palette: ThemePalette }) {
  return <View style={[s.chip, kind === 'plan' && [s.chipPlan, { borderColor: palette.primary }], kind === 'pending' && s.chipPending, kind === 'done' && s.chipDone]}>
    <Text numberOfLines={1} style={[s.chipText, kind === 'plan' && { color: palette.primaryDark }, kind === 'pending' && s.chipPendingText]}>
      {kind === 'pending' && <Text style={s.chipDot}>● </Text>}{kind === 'done' && '✓ '}{label}
    </Text>
  </View>;
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
      {loading && <Text accessibilityLiveRegion="polite" style={s.status}>일정을 불러오는 중…</Text>}
      {failed && <Pressable accessibilityRole="button" onPress={retry}><Text style={s.status}>일정을 불러오지 못했어요. 다시 시도</Text></Pressable>}
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
                const states = items.map(item => `${item.title} ${chipLabels[chipKind(item.experience_phase)]}`);
                return <Pressable accessibilityRole="button" accessibilityLabel={[`${dateLabel(date.dateString)}, 일정 ${items.length}개`, ...states].join(', ')} onPress={() => onOpenDay(date.dateString)} style={[s.cell, selectedDate === date.dateString && active]}>
                  <Text style={[s.dayNumber, date.dateString === dateKey(new Date()) && accent]}>{date.day}</Text>
                  {items.slice(0, 2).map(item => <PhaseChip key={item.id} label={item.title} kind={chipKind(item.experience_phase)} palette={palette} />)}
                  {items.length > 2 && <Text style={s.more}>+{items.length - 2}</Text>}
                </Pressable>;
              }} /> : <View style={s.viewport}>
                {mode === 'week' && <View style={s.weekStrip}>{days.map((day, index) => <Pressable key={day} accessibilityRole="button" accessibilityLabel={dateLabel(day)} onPress={() => onSelect(day)} style={[s.weekDate, selectedDate === day && active]}><Text style={s.muted}>{weekdays[index]}</Text><Text style={s.dayNumber}>{Number(day.slice(8))}</Text></Pressable>)}</View>}
                <ScrollView contentContainerStyle={s.agenda}>{mode === 'week' ? days.map(day => renderDay(day, true)) : renderDay(key)}</ScrollView>
              </View>}
            </View>;
          })}
        </ScrollView>}
      </View>
      {mode === 'month' && <View style={s.legend}>
        {(['plan', 'pending', 'done'] as const).map(kind => <PhaseChip key={kind} label={chipLabels[kind]} kind={kind} palette={palette} />)}
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
  // 칩 높이를 모양과 상관없이 맞추려고, 테두리 1을 쓰는 예정 칩은 안쪽 여백을 1만큼 줄인다.
  chip: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 2, marginBottom: 2 }, chipText: { fontSize: 10, color: '#fff' },
  chipPlan: { backgroundColor: colors.surface, borderWidth: 1, paddingHorizontal: 2, paddingVertical: 1 },
  chipPending: { backgroundColor: colors.orangeSoft }, chipPendingText: { color: colors.orangeDark }, chipDot: { color: colors.orange, fontSize: 8 },
  chipDone: { backgroundColor: colors.sage },
  more: { fontSize: 11, textAlign: 'center', color: colors.muted },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  weekStrip: { flexDirection: 'row', padding: 4 }, weekDate: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  agenda: { padding: 12, gap: 16 }, agendaDay: { gap: 8 }, dayHeading: { fontSize: 14, fontWeight: '600', paddingVertical: 8 }, empty: { color: colors.muted, paddingVertical: 16 },
  status: { padding: 8, textAlign: 'center', fontSize: 12, color: colors.muted },
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,25,23,0.35)' },
  sheet: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' }, gridItem: { width: '25%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  apply: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, applyText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
