import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSpaces } from '@/features/spaces/space-context';
import { createSchedule } from '@/features/schedules/schedule-api';
import { SelectButton, TIME_PATTERN, TimeSelect } from '@/features/schedules/time-select';
import { getApiError } from '@/shared/api/api-error';
import { colors, radii, spacing, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { seoulDateKey } from '@/shared/utils/date';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 하루 만들기 1단계 — 하루 정하기.
 *
 * "갈 곳 정하기"를 누르면 **그 자리에서 하루를 저장하고** 2단계(schedules/[id]/plan)로
 * 넘어간다. 웹의 ScheduleNewPage와 같은 흐름이다. 예전처럼 장소까지 다 고른 뒤 한꺼번에
 * 저장하지 않는 이유는 2단계 화면(plan.tsx) 머리 주석에 있다.
 */
export default function NewScheduleScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentSpace, currentSpaceId } = useSpaces();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const initialDate = useMemo(() => {
    const value = Array.isArray(params.date) ? params.date[0] : params.date;
    return value && DATE_PATTERN.test(value) ? value : seoulDateKey(new Date().toISOString());
  }, [params.date]);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [calendarTarget, setCalendarTarget] = useState<'start' | 'end' | null>(null);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('15:00');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 상태값(submitting)은 다음 렌더에야 반영돼서, 빠르게 두 번 누르면 둘 다 통과한다.
  // 그러면 같은 하루가 둘 생긴다. 즉시 바뀌는 ref로 한 번 더 막는다.
  const submitLock = useRef(false);
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();

  function validateBasics() {
    if (!title.trim()) return '하루의 이름을 입력해 주세요.';
    if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) return '시작일과 종료일을 선택해 주세요.';
    if (endDate < startDate) return '종료일은 시작일보다 빠를 수 없어요.';
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return '시간을 HH:mm 형식으로 입력해 주세요.';
    if (startDate === endDate && endTime <= startTime) return '종료 시간은 시작 시간보다 늦어야 해요.';
    if (!currentSpaceId) return '하루를 저장할 스페이스를 먼저 선택해 주세요.';
    return null;
  }

  /** 하루를 저장하고 2단계로 넘어간다. */
  async function saveAndContinue() {
    const validation = validateBasics();
    if (validation) { showSnackbar(validation); return; }
    if (submitLock.current) return;
    submitLock.current = true;
    dismissSnackbar();
    setSubmitting(true);
    try {
      const schedule = await createSchedule({
        spaceId: currentSpaceId as string,
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        startTime,
        endTime,
      });
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
      // replace를 쓴다. 2단계에서 뒤로 가기로 이 화면에 돌아와 다시 누르면 같은 하루가
      // 또 만들어진다.
      router.replace({ pathname: '/schedules/[id]/plan', params: { id: String(schedule.id) } });
    } catch (caught) {
      showSnackbar(getApiError(caught).message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.headerButton}><Text style={styles.back}>‹</Text></Pressable>
          <Text style={styles.headerTitle}>하루 만들기</Text>
          <Pressable accessibilityLabel="닫기" onPress={() => router.back()} style={styles.headerButton}><Text style={styles.close}>×</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.description}>저장할 스페이스: {currentSpace?.name ?? '스페이스 확인 중'}</Text>
          <View style={styles.progress}><View style={styles.progressOn} /><View style={styles.progressOff} /><Text style={styles.progressText}>1 / 2</Text></View>

          <Text style={styles.eyebrow}>STEP 1 · 하루 정하기</Text>
          <Text style={styles.title}>어떤 하루를{"\n"}보내고 싶나요?</Text>
          <Text style={styles.description}>세부 일정표보다 그날의 모습을 먼저 떠올려 보세요.</Text>

          <View style={styles.form}>
            <Field label="하루의 이름" required>
              <TextInput accessibilityLabel="하루의 이름, 필수" onChangeText={setTitle} placeholder="하루의 이름을 작성해주세요" placeholderTextColor={colors.muted} style={styles.input} value={title} />
            </Field>
            <View style={styles.timingCard}>
              <View style={styles.timingRow}>
                <View style={[styles.timingAccent, styles.timingAccentStart]} />
                <View style={styles.dateColumn}><Field label="시작일" required><SelectButton label={startDate} onPress={() => setCalendarTarget('start')} /></Field></View>
                <View style={styles.timeColumn}><Field label="시작 시간" required><TimeSelect value={startTime} onChange={setStartTime} /></Field></View>
              </View>
              <View style={styles.timingDivider} />
              <View style={styles.timingRow}>
                <View style={[styles.timingAccent, styles.timingAccentEnd]} />
                <View style={styles.dateColumn}><Field label="종료일" required><SelectButton label={endDate} onPress={() => setCalendarTarget('end')} /></Field></View>
                <View style={styles.timeColumn}><Field label="종료 시간" required><TimeSelect value={endTime} onChange={setEndTime} /></Field></View>
              </View>
            </View>
            <Field label="하루의 밑그림">
              <TextInput accessibilityLabel="하루의 밑그림" multiline onChangeText={setDescription} placeholder="어떤 하루를 보내고 싶은지 적어주세요" placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} textAlignVertical="top" value={description} />
            </Field>
          </View>
          <Pressable disabled={submitting} onPress={saveAndContinue} style={[styles.primaryButton, submitting && styles.disabled]}>
            <Text style={styles.primaryText}>{submitting ? '하루를 만드는 중…' : '갈 곳 정하기  →'}</Text>
          </Pressable>
        </ScrollView>
        <DatePickerModal
          endDate={endDate}
          onClose={() => setCalendarTarget(null)}
          onSelect={(date) => {
            if (calendarTarget === 'start') {
              setStartDate(date);
              if (endDate < date) setEndDate(date);
            } else {
              setEndDate(date);
            }
            setCalendarTarget(null);
          }}
          startDate={startDate}
          target={calendarTarget}
        />
        <Snackbar notice={notice} onDismiss={dismissSnackbar} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.field}><Text accessibilityLabel={required ? `${label}, 필수` : label} style={styles.label}>{label}{required ? <Text style={styles.requiredMark}> *</Text> : null}</Text>{children}</View>;
}

function DatePickerModal({ target, startDate, endDate, onSelect, onClose }: {
  target: 'start' | 'end' | null;
  startDate: string;
  endDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={target !== null}>
      <Pressable onPress={onClose} style={styles.modalBackdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.calendarSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{target === 'start' ? '시작일 선택' : '종료일 선택'}</Text>
            <Pressable accessibilityLabel="날짜 선택 닫기" onPress={onClose}><Text style={styles.sheetClose}>×</Text></Pressable>
          </View>
          <Calendar
            current={target === 'end' ? endDate : startDate}
            markingType="period"
            markedDates={getMarkedDates(startDate, endDate, palette)}
            minDate={target === 'end' ? startDate : undefined}
            onDayPress={(day: DateData) => onSelect(day.dateString)}
            theme={{
              arrowColor: palette.primary,
              selectedDayBackgroundColor: palette.primary,
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: palette.primaryDark,
              calendarBackground: colors.surface,
              textDayFontWeight: '600',
        textMonthFontWeight: '600',
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function getMarkedDates(startDate: string, endDate: string, palette: ThemePalette) {
  const marks: Record<string, { color: string; startingDay?: boolean; endingDay?: boolean; textColor: string }> = {};
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  for (let value = start; value <= end; value += 86_400_000) {
    const key = new Date(value).toISOString().slice(0, 10);
    marks[key] = {
      color: palette.primarySoft,
      startingDay: key === startDate,
      endingDay: key === endDate,
      textColor: key === startDate || key === endDate ? palette.primaryDark : colors.text,
    };
  }
  return marks;
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.background, flexDirection: 'row', minHeight: 58, paddingHorizontal: spacing.sm },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  back: { color: colors.text, fontSize: 35, lineHeight: 38 },
  close: { color: colors.muted, fontSize: 25 },
  headerTitle: { color: colors.text, flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: 50 },
  progress: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  progressOn: { backgroundColor: palette.primary, borderRadius: 4, flex: 1, height: 4 },
  progressOff: { backgroundColor: colors.border, borderRadius: 4, flex: 1, height: 4 },
  progressText: { color: colors.muted, fontSize: 14, fontWeight: '600', marginLeft: 5 },
  eyebrow: { color: palette.primaryDark, fontSize: 14, fontWeight: '600', letterSpacing: 1.1, marginTop: 28 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -1, lineHeight: 35, marginTop: 9 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  form: { gap: 15, marginTop: 25 },
  field: { gap: 7 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  requiredMark: { color: palette.primary },
  input: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, color: colors.text, fontSize: 14, minHeight: 52, paddingHorizontal: 14, paddingVertical: 13 },
  textarea: { minHeight: 92 },
  timingCard: { backgroundColor: colors.surface, borderRadius: radii.card, elevation: 2, overflow: 'hidden', shadowColor: '#432F28', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 18 },
  timingRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 13, paddingVertical: 14, position: 'relative' },
  timingAccent: { borderBottomRightRadius: 3, borderTopRightRadius: 3, bottom: 18, left: 0, position: 'absolute', top: 18, width: 3 },
  timingAccentStart: { backgroundColor: palette.primary, opacity: 0.55 },
  timingAccentEnd: { backgroundColor: palette.primary },
  timingDivider: { backgroundColor: colors.border, height: 1 },
  dateColumn: { flex: 1, minWidth: 0 },
  timeColumn: { flexBasis: 104, flexGrow: 0, flexShrink: 0 },
  primaryButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: radii.lg, elevation: 2, justifyContent: 'center', marginTop: 22, minHeight: 54, paddingHorizontal: 18, shadowColor: palette.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  modalBackdrop: { backgroundColor: 'rgba(40, 35, 33, 0.38)', flex: 1, justifyContent: 'flex-end' },
  calendarSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28, paddingHorizontal: 14, paddingTop: 10 },
  sheetHeader: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 4 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  sheetClose: { color: colors.muted, fontSize: 28, padding: 8 },
});
