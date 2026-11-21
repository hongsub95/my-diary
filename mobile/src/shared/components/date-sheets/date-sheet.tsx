import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { BottomSheet } from './bottom-sheet';
import { parseKey, shiftMonth, toKey, todayKey } from './date-keys';
import { MonthGrid } from './month-grid';
import { useHolidays } from './use-holidays';

type View_ = 'date' | 'month' | 'year';

type DateSheetProps = {
  visible: boolean;
  /** 지금 값('YYYY-MM-DD'). 비어 있으면 오늘 달을 연다 */
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  /** 시트 제목 */
  title?: string;
  /** month면 달만 고른다(1일로 돌려준다). 캘린더 월간 보기의 이동에 쓴다 */
  mode?: 'date' | 'month';
  /** "날짜 없음"으로 값을 비울 수 있게 한다(모아보기 기간 필터) */
  clearable?: boolean;
};

/**
 * 하루 고르기 시트 (시안 A, 유아이볼 "에이닷" 참고).
 *
 * 날짜를 누르는 순간 정해지고 닫힌다. 확인 버튼을 한 번 더 누르게 하지 않는 이유: 하루를
 * 고르는 화면은 대부분 고른 뒤 바로 다음 칸으로 넘어가서, 확인 단계가 있으면 매번 한 번씩
 * 더 누르게 된다. 잘못 골랐으면 칸을 다시 눌러 고치면 된다.
 *
 * 가운데 "2026년 ⌄ 12월 ⌄"를 누르면 연도·달 고르기로 바뀐다. 몇 년 전 날짜도 화살표를
 * 수십 번 누르지 않고 고를 수 있다. 연도는 1900~2100으로 막는다(이전 팝오버와 같다).
 */
export function DateSheet(props: DateSheetProps) {
  const { visible, onClose, title = '날짜' } = props;
  // 본문은 열 때마다 새로 만든다. 그래야 지난번에 넘겨 둔 달이 남지 않고 늘 지금 값의 달에서 시작한다.
  return (
    <BottomSheet visible={visible} onClose={onClose} label={`${title} 고르기`}>
      <DateSheetBody {...props} title={title} />
    </BottomSheet>
  );
}

function DateSheetBody({ value, onChange, onClose, title, mode = 'date', clearable }: DateSheetProps & { title: string }) {
  const s = useThemedStyles(createStyles);
  const today = todayKey();
  const start = parseKey(value || today);
  const [cursor, setCursor] = useState({ year: start.year, month: start.month });
  const [view, setView] = useState<View_>(mode);
  const holidays = useHolidays([cursor.year]);

  const pick = (key: string) => { onChange(key); onClose(); };
  const yearStart = Math.floor(cursor.year / 12) * 12;
  const move = (step: number) => {
    if (view === 'date') setCursor(shiftMonth(cursor.year, cursor.month, step));
    else {
      const year = cursor.year + step * (view === 'year' ? 12 : 1);
      if (year >= 1900 && year <= 2100) setCursor({ ...cursor, year });
    }
  };
  const moveLabel = (dir: '이전' | '다음') => `${dir} ${view === 'date' ? '달' : view === 'month' ? '연도' : '연도 구간'}`;

  return (
    <>
      <View style={s.head}>
        <Text accessibilityRole="header" style={s.title}>{title}</Text>
        <View style={s.chips}>
          {clearable && (
            <Pressable accessibilityRole="button" onPress={() => pick('')} style={[s.chip, s.chipQuiet]}>
              <Text style={s.chipQuietText}>날짜 없음</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={() => pick(mode === 'month' ? toKey(parseKey(today).year, parseKey(today).month, 1) : today)} style={s.chip}>
            <Text style={s.chipText}>{mode === 'month' ? '이번 달' : '오늘'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={s.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel={moveLabel('이전')} onPress={() => move(-1)} style={s.arrow}><Text style={s.arrowText}>‹</Text></Pressable>
        <View style={s.navTitles}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${cursor.year}년, 연도 고르기`} onPress={() => setView('year')} style={s.navTitle}>
            <Text style={s.navText}>{view === 'year' ? `${Math.max(1900, yearStart)}–${Math.min(2100, yearStart + 11)}` : `${cursor.year}년`} <Text style={s.caret}>⌄</Text></Text>
          </Pressable>
          {view === 'date' && (
            <Pressable accessibilityRole="button" accessibilityLabel={`${cursor.month}월, 달 고르기`} onPress={() => setView('month')} style={s.navTitle}>
              <Text style={s.navText}>{cursor.month}월 <Text style={s.caret}>⌄</Text></Text>
            </Pressable>
          )}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={moveLabel('다음')} onPress={() => move(1)} style={s.arrow}><Text style={s.arrowText}>›</Text></Pressable>
      </View>

      {view === 'date' ? (
        <MonthGrid year={cursor.year} month={cursor.month} holidays={holidays} today={today} selected={value} showHolidayNames onPress={pick} />
      ) : (
        <View style={s.grid}>
          {Array.from({ length: 12 }, (_, i) => (view === 'year' ? yearStart + i : i + 1)).map(number => {
            const disabled = view === 'year' && (number < 1900 || number > 2100);
            const selected = view === 'year' ? number === cursor.year : number === cursor.month;
            return (
              <Pressable
                key={number}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={view === 'year' ? `${number}년` : `${cursor.year}년 ${number}월`}
                onPress={() => {
                  if (view === 'year') { setCursor({ ...cursor, year: number }); setView('month'); return; }
                  if (mode === 'month') { pick(toKey(cursor.year, number, 1)); return; }
                  setCursor({ ...cursor, month: number });
                  setView('date');
                }}
                style={[s.gridCell, selected && s.gridSelected, disabled && s.disabled]}>
                <Text style={[s.gridText, selected && s.gridSelectedText]}>{number}{view === 'year' ? '년' : '월'}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={onClose} style={s.close}><Text style={s.closeText}>닫기</Text></Pressable>
      {view === 'date' && <Text style={s.hint}>날짜를 누르면 바로 정해져요</Text>}
    </>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  head: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { backgroundColor: palette.primarySoft, borderRadius: 999, justifyContent: 'center', minHeight: 32, paddingHorizontal: 12 },
  chipText: { color: palette.primaryDark, fontSize: 12, fontWeight: '600' },
  chipQuiet: { backgroundColor: colors.surfaceMuted },
  chipQuietText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  nav: { alignItems: 'center', flexDirection: 'row', marginBottom: 4, marginTop: 8 },
  arrow: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 22, height: 40, justifyContent: 'center', width: 40 },
  arrowText: { color: colors.muted, fontSize: 20, lineHeight: 22 },
  navTitles: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  navTitle: { justifyContent: 'center', minHeight: 44, paddingHorizontal: 4 },
  navText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  caret: { color: colors.muted, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 6 },
  gridCell: { alignItems: 'center', borderRadius: 12, justifyContent: 'center', minHeight: 52, width: '33.3333%' },
  gridSelected: { backgroundColor: palette.primary },
  gridText: { color: colors.text, fontSize: 14 },
  gridSelectedText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.3 },
  close: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 16, justifyContent: 'center', marginTop: 12, minHeight: 50 },
  closeText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },
});
