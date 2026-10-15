import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { formatRangeShort, periodBetween } from './schedule-dates';
import type { ScheduleForm } from './schedule-management';
import { ScheduleRangeSheet } from './schedule-range-sheet';
import { TimeSelect } from './time-select';

const TITLE_MAX = 200;

/**
 * 하루의 기본 정보 입력 — 하루 만들기 1단계와 일정 고치기가 함께 쓴다.
 *
 * 두 화면이 따로 그리던 입력을 하나로 합쳤다(2026-10-15 사용자 결정, 시안 A "목록형 한 장").
 * 이름을 크게 쓰고, 날짜와 시간은 "이름 — 값" 행 두 개로 묶는다. 날짜 행을 누르면 달력
 * 시트에서 시작일·종료일을 한 번에 고른다. 저장·검증·버튼은 화면마다 다르므로 여기서는
 * 입력만 다룬다.
 *
 * @param form 지금 입력값
 * @param onChange 바뀐 필드만 담아 알린다
 * @param disabled 저장 중처럼 고칠 수 없을 때
 * @param memoLabel 메모 칸 이름. 만들기는 "하루의 밑그림", 고치기는 "메모"로 기존 문구를 유지한다
 * @param ref 이름 입력칸. 이름이 비었을 때 화면이 여기로 초점을 옮긴다
 */
export const ScheduleBasicsFields = forwardRef<TextInput, {
  form: ScheduleForm;
  onChange: (patch: Partial<ScheduleForm>) => void;
  disabled?: boolean;
  memoLabel?: string;
}>(function ScheduleBasicsFields({ form, onChange, disabled = false, memoLabel = '하루의 밑그림' }, ref) {
  const styles = useThemedStyles(createStyles);
  const [rangeOpen, setRangeOpen] = useState(false);
  const range = formatRangeShort(form.start_date, form.end_date);
  const period = periodBetween(form.start_date, form.end_date);

  return (
    <View>
      <Text style={styles.prompt}>어떤 하루인가요?</Text>
      <View style={styles.titleRow}>
        <TextInput
          ref={ref}
          accessibilityLabel="하루의 이름, 필수"
          editable={!disabled}
          maxLength={TITLE_MAX}
          onChangeText={title => onChange({ title })}
          placeholder="하루의 이름을 적어 주세요"
          placeholderTextColor={colors.muted}
          style={styles.titleInput}
          value={form.title}
        />
        <Text style={styles.counter}>{form.title.length}/{TITLE_MAX}</Text>
      </View>

      <View style={styles.group}>
        {/* 날짜 행 전체가 버튼이다. 박수(당일·1박 2일) 배지는 화면에 두지 않는다(2026-10-15
            사용자 결정). 날짜 시트 위쪽에서 고르는 동안 보여 주고, 화면 읽기 도구에는 계속 알린다. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`날짜, ${range}, ${period}, 바꾸기`}
          disabled={disabled}
          onPress={() => setRangeOpen(true)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}>
          <Text style={styles.rowLabel}>날짜</Text>
          <View style={styles.rowValue}>
            <Text style={styles.dateText}>{range}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
        <View style={[styles.row, styles.rowDivider]}>
          <Text style={styles.rowLabel}>시간</Text>
          {/* 시간은 칸 두 개를 바로 누르게 둔다. 행 하나로 묶어 시트를 또 열면 한 번 더 눌러야 한다. */}
          <View style={styles.times}>
            <View style={styles.timeBox}>
              <TimeSelect accessibilityLabel="시작 시간 선택" disabled={disabled} value={form.start_time} onChange={start_time => onChange({ start_time })} />
            </View>
            <Text style={styles.tilde}>~</Text>
            <View style={styles.timeBox}>
              <TimeSelect accessibilityLabel="종료 시간 선택" disabled={disabled} value={form.end_time} onChange={end_time => onChange({ end_time })} />
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.memoLabel}>{memoLabel} <Text style={styles.optional}>(선택)</Text></Text>
      <TextInput
        accessibilityLabel={memoLabel}
        editable={!disabled}
        multiline
        onChangeText={description => onChange({ description })}
        placeholder="어떤 하루를 보내고 싶은지 적어 주세요"
        placeholderTextColor={colors.muted}
        style={styles.memo}
        textAlignVertical="top"
        value={form.description}
      />

      <ScheduleRangeSheet
        visible={rangeOpen}
        start={form.start_date}
        end={form.end_date}
        onClose={() => setRangeOpen(false)}
        onApply={({ start, end }) => { onChange({ start_date: start, end_date: end }); setRangeOpen(false); }}
      />
    </View>
  );
});

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  prompt: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 24 },
  titleRow: { alignItems: 'center', borderBottomColor: palette.primary, borderBottomWidth: 2, flexDirection: 'row', gap: 8, marginTop: 8 },
  titleInput: { color: colors.text, flex: 1, fontSize: 22, fontWeight: '600', letterSpacing: -0.4, minHeight: 52, paddingVertical: 8 },
  counter: { color: colors.muted, fontSize: 12 },
  group: { backgroundColor: colors.surfaceMuted, borderRadius: radii.lg, marginTop: 24 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 10 },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  rowLabel: { color: colors.muted, fontSize: 14, width: 32 },
  rowValue: { flex: 1, gap: 4 },
  dateText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  chevron: { color: colors.muted, fontSize: 22 },
  times: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8 },
  timeBox: { flex: 1, maxWidth: 120 },
  tilde: { color: colors.muted },
  memoLabel: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 24 },
  optional: { color: colors.muted, fontWeight: '400' },
  memo: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, color: colors.text, fontSize: 14, marginTop: 8, minHeight: 96, padding: 14 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
