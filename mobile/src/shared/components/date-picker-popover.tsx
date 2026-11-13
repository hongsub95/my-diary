import { useEffect, useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '@/shared/api/client';
import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

type Mode = 'date' | 'month' | 'year';
type Range = { start: string; end: string };
type Props = {
  visible: boolean; anchorRef: RefObject<View | null>; value: string;
  onChange: (value: string) => void; onClose: () => void;
  mode?: Mode; clearable?: boolean; range?: Range; onRangeApply?: (range: Range) => void;
};
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = () => key(new Date());
function inMonth(value: string, year: number, month: number) {
  return key(new Date(year, month - 1, Math.min(Number(value.slice(8)), new Date(year, month, 0).getDate()), 12));
}

/** Transparent native overlay, with only a small calendar attached to its trigger. */
export function DatePickerPopover(props: Props) {
  return props.visible ? <OpenPicker {...props} /> : null;
}

function OpenPicker({ anchorRef, value, onChange, onClose, mode: selectionMode = 'date', clearable, range, onRangeApply }: Props) {
  const s = useThemedStyles(createStyles);
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [draft, setDraft] = useState(value || today());
  const [mode, setMode] = useState<Mode>(selectionMode);
  const [period, setPeriod] = useState<Range>(range || { start: value, end: value });
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const [height, setHeight] = useState(360);
  const close = () => { onClose(); requestAnimationFrame(() => anchorRef.current?.focus()); };
  const year = Number(draft.slice(0, 4));
  const month = Number(draft.slice(5, 7));
  const yearStart = Math.floor(year / 12) * 12;
  const holidays = useQuery({
    queryKey: ['calendar-holidays', 'KR', year],
    queryFn: async ({ signal }) => (await apiClient.get<{ days: { date: string; names: string[] }[] }>('/calendar/holidays', { params: { year, country: 'KR' }, signal })).data,
    staleTime: 86400000, retry: 1, enabled: mode === 'date',
  });
  const holidayDays = new Map((holidays.data?.days || []).map(day => [day.date, day.names]));
  useEffect(() => {
    Keyboard.dismiss();
    const timer = setTimeout(() => anchorRef.current?.measureInWindow((x, y, width, anchorHeight) => setAnchor({ x, y, width, height: anchorHeight })), 0);
    return () => clearTimeout(timer);
  }, [anchorRef, screen.width, screen.height]);
  const width = Math.min(336, screen.width - 24);
  const below = anchor ? screen.height - insets.bottom - anchor.y - anchor.height - 20 : 0;
  const above = anchor ? anchor.y - insets.top - 20 : 0;
  const useBelow = below >= height || below >= above;
  const maxHeight = Math.max(80, useBelow ? below : above);
  const position = anchor ? {
    width, maxHeight,
    left: Math.max(12, Math.min(anchor.x + anchor.width / 2 - width / 2, screen.width - width - 12)),
    ...(useBelow ? { top: Math.max(insets.top + 8, anchor.y + anchor.height + 8) } : { bottom: Math.max(insets.bottom + 8, screen.height - anchor.y + 8) }),
  } : {};
  const navigate = (step: number) => {
    const next = mode === 'date' ? inMonth(draft, year, month + step) : inMonth(draft, year + step * (mode === 'year' ? 12 : 1), month);
    if (Number(next.slice(0, 4)) >= 1900 && Number(next.slice(0, 4)) <= 2100) setDraft(next);
  };
  const choose = (next: string) => {
    setDraft(next);
    if (!range) { onChange(next); close(); return; }
    if (!awaitingEnd || next < period.start) {
      setPeriod({ start: next, end: next }); setAwaitingEnd(true);
    } else { setPeriod({ start: period.start, end: next }); setAwaitingEnd(false); }
  };
  const first = new Date(year, month - 1, 1, 12).getDay();
  const length = new Date(year, month, 0).getDate();
  return <Modal transparent visible animationType="none" onRequestClose={close}>
    <Pressable style={s.overlay} accessibilityRole="button" accessibilityLabel="날짜 선택 닫기" onPress={close} />
    {anchor && <View accessibilityLabel="날짜 선택" accessibilityViewIsModal onAccessibilityEscape={close} style={[s.popover, position]} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={mode === 'date' ? '이전 달' : mode === 'month' ? '이전 연도' : '이전 연도 구간'} style={s.arrow} onPress={() => navigate(-1)}><Text style={s.arrowText}>‹</Text></Pressable>
          <View style={s.heading}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${year}년, 연도 선택`} style={s.titleButton} onPress={() => setMode('year')}><Text style={s.title}>{mode === 'year' ? `${Math.max(1900, yearStart)}–${Math.min(2100, yearStart + 11)}` : `${year}년`} <Text style={s.caret}>⌄</Text></Text></Pressable>
            {mode === 'date' && <Pressable accessibilityRole="button" accessibilityLabel={`${month}월, 월 선택`} style={s.titleButton} onPress={() => setMode('month')}><Text style={s.title}>{month}월 <Text style={s.caret}>⌄</Text></Text></Pressable>}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={mode === 'date' ? '다음 달' : mode === 'month' ? '다음 연도' : '다음 연도 구간'} style={s.arrow} onPress={() => navigate(1)}><Text style={s.arrowText}>›</Text></Pressable>
        </View>
        {mode === 'date' ? <>
          <View style={s.days}>{['일', '월', '화', '수', '목', '금', '토'].map((day, i) => <Text key={day} style={[s.weekday, i === 0 && s.holiday, i === 6 && s.saturday]}>{day}</Text>)}</View>
          <View style={s.days}>{Array.from({ length: Math.ceil((first + length) / 7) * 7 }, (_, i) => {
            const day = i - first + 1;
            if (day < 1 || day > length) return <View key={i} style={s.day} />;
            const date = `${draft.slice(0, 7)}-${String(day).padStart(2, '0')}`;
            const selected = range ? date === period.start || date === period.end : date === value;
            const inside = range && date > period.start && date < period.end;
            return <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${year}년 ${month}월 ${day}일${holidayDays.has(date) ? `, ${holidayDays.get(date)?.join(', ')}` : ''}`} accessibilityState={{ selected }} onPress={() => choose(date)} style={[s.day, inside && s.inside, selected && s.selected]}><Text style={[s.dayText, (i % 7 === 0 || holidayDays.has(date)) && s.holiday, i % 7 === 6 && !holidayDays.has(date) && s.saturday, date === today() && s.today, selected && s.selectedText]}>{day}</Text></Pressable>;
          })}</View>
        </> : <View style={s.grid}>{Array.from({ length: 12 }, (_, i) => mode === 'year' ? yearStart + i : i + 1).map(number => {
          const disabled = mode === 'year' && (number < 1900 || number > 2100);
          const selected = number === (mode === 'year' ? year : month);
          return <Pressable key={number} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${mode === 'year' ? number : year}년${mode === 'month' ? ` ${number}월` : ''}`} accessibilityState={{ selected, disabled }} style={[s.gridCell, selected && s.selected, disabled && s.disabled]} onPress={() => {
            const next = inMonth(draft, mode === 'year' ? number : year, mode === 'month' ? number : month);
            setDraft(next);
            if (mode === 'year') { if (selectionMode === 'year') choose(next); else setMode('month'); }
            else if (selectionMode === 'month') choose(next); else setMode('date');
          }}><Text style={[s.dayText, selected && s.selectedText]}>{number}{mode === 'year' ? '년' : '월'}</Text></Pressable>;
        })}</View>}
        {range && <View style={s.rangeFooter}><Text style={s.rangeText}>{period.start.slice(5).replace('-', '.')} – {period.end.slice(5).replace('-', '.')}</Text><Pressable accessibilityRole="button" accessibilityLabel="선택한 기간 저장" style={s.save} onPress={() => { onRangeApply?.(period); close(); }}><Text style={s.saveText}>저장</Text></Pressable></View>}
        {clearable && <Pressable accessibilityRole="button" style={s.clear} onPress={() => { onChange(''); close(); }}><Text style={s.rangeText}>날짜 해제</Text></Pressable>}
      </ScrollView>
    </View>}
  </Modal>;
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  popover: { position: 'absolute', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, elevation: 10, shadowColor: colors.text, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 18, overflow: 'hidden' },
  body: { padding: 10 }, header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 }, heading: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  titleButton: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' }, title: { fontSize: 15, fontWeight: '600', color: colors.text }, caret: { color: colors.muted, fontSize: 12 },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, arrowText: { color: colors.muted, fontSize: 25 },
  days: { flexDirection: 'row', flexWrap: 'wrap' }, weekday: { width: '14.2857%', textAlign: 'center', paddingVertical: 8, fontSize: 12, color: colors.muted },
  day: { width: '14.2857%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, dayText: { fontSize: 14, color: colors.text },
  holiday: { color: colors.danger }, saturday: { color: '#4673AD' }, today: { fontWeight: '700', textDecorationLine: 'underline' },
  selected: { backgroundColor: palette.primary }, selectedText: { color: '#FFFFFF', fontWeight: '600' }, inside: { backgroundColor: palette.primarySoft, borderRadius: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 6 }, gridCell: { width: '33.3333%', minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12 }, disabled: { opacity: 0.3 },
  rangeFooter: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, rangeText: { color: colors.muted, fontSize: 12 }, save: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 10, backgroundColor: palette.primary }, saveText: { color: '#FFF', fontWeight: '600' }, clear: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
