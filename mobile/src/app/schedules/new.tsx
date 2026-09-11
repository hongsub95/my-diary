import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { PlacePicker } from '@/features/places/place-picker';
import {
  addSchedulePlace,
  createSchedule,
  type AddSchedulePlaceInput,
} from '@/features/schedules/schedule-api';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { seoulDateKey } from '@/shared/utils/date';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  const minutes = index % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}`;
});

// 저장 전까지 화면에 들고 있는 장소. 검색 결과에서 왔다면 좌표와 출처까지 함께
// 담아둬야 저장할 때 잃지 않는다. 직접 입력한 장소는 이름만 있다.
type DraftPlace = { id: number; place: AddSchedulePlaceInput };

export default function NewScheduleScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const initialDate = useMemo(() => {
    const value = Array.isArray(params.date) ? params.date[0] : params.date;
    return value && DATE_PATTERN.test(value) ? value : seoulDateKey(new Date().toISOString());
  }, [params.date]);

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [calendarTarget, setCalendarTarget] = useState<'start' | 'end' | null>(null);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('15:00');
  const [description, setDescription] = useState('');
  const [places, setPlaces] = useState<DraftPlace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateBasics() {
    if (!title.trim()) return '하루의 이름을 입력해 주세요.';
    if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) return '시작일과 종료일을 선택해 주세요.';
    if (endDate < startDate) return '종료일은 시작일보다 빠를 수 없어요.';
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return '시간을 HH:mm 형식으로 입력해 주세요.';
    if (startDate === endDate && endTime <= startTime) return '종료 시간은 시작 시간보다 늦어야 해요.';
    if (!user?.default_space_id) return '하루를 저장할 기본 스페이스가 없어요.';
    return null;
  }

  function moveNext() {
    const validation = validateBasics();
    if (validation) return setError(validation);
    setError(null);
    setStep(2);
  }

  /** 고른 장소를 저장 전 목록에 쌓는다. 담은 순서가 곧 방문 순서다. */
  function addPlace(place: AddSchedulePlaceInput) {
    if (!place.name) return;
    setPlaces((current) => [...current, { id: Date.now(), place }]);
  }

  async function handleSubmit() {
    const validation = validateBasics();
    if (validation) return setError(validation);
    setSubmitting(true);
    setError(null);
    try {
      const schedule = await createSchedule({
        spaceId: user?.default_space_id as string,
        title: title.trim(),
        description: description.trim(),
        startDate,
        endDate,
        startTime,
        endTime,
      });
      // 담아둔 순서가 곧 방문 순서다. 동시에 보내면 순서가 뒤섞이므로 차례로 넣는다.
      for (const draft of places) {
        await addSchedulePlace(schedule.id, draft.place);
      }
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
      router.replace('/(tabs)/home');
    } catch (caught) {
      setError(getApiError(caught).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="뒤로 가기" onPress={() => step === 2 ? setStep(1) : router.back()} style={styles.headerButton}><Text style={styles.back}>‹</Text></Pressable>
          <Text style={styles.headerTitle}>하루 만들기</Text>
          <Pressable onPress={() => router.back()} style={styles.headerButton}><Text style={styles.close}>×</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.progress}><View style={styles.progressOn} /><View style={step === 2 ? styles.progressOn : styles.progressOff} /><Text style={styles.progressText}>{step} / 2</Text></View>

          {step === 1 ? (
            <>
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
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable onPress={moveNext} style={styles.primaryButton}><Text style={styles.primaryText}>갈 곳 정하기  →</Text></Pressable>
            </>
          ) : (
            <>
              <Text style={styles.eyebrow}>STEP 2 · 갈 곳 정하기</Text>
              <Text style={styles.title}>이 하루에{"\n"}어디를 담아볼까요?</Text>
              <Text style={styles.description}>장소를 고른 순서가 그날의 흐름이 됩니다.</Text>

              {/* 일정 상세와 같은 패널을 쓴다. 담는 곳만 다르다 — 여기서는 저장 전
                  목록에 쌓고, 상세에서는 서버에 바로 담는다. */}
              <PlacePicker onPick={addPlace} />

              <View style={styles.placeList}>
                {places.length ? places.map((place, index) => (
                  <View key={place.id} style={styles.placeRow}>
                    <View style={styles.placeNumber}><Text style={styles.placeNumberText}>{index + 1}</Text></View>
                    <View style={styles.placeCopy}><Text style={styles.placeName}>{place.place.name}</Text><Text style={styles.placeMeta}>{place.place.address ?? '상세 주소와 시간은 나중에 추가할 수 있어요.'}</Text></View>
                    <Pressable onPress={() => setPlaces((current) => current.filter((item) => item.id !== place.id))}><Text style={styles.remove}>×</Text></Pressable>
                  </View>
                )) : (
                  <View style={styles.emptyPlaces}><Text style={styles.emptyPlacesIcon}>⌖</Text><Text style={styles.emptyPlacesTitle}>아직 담은 장소가 없어요</Text><Text style={styles.emptyPlacesText}>장소 없이 하루만 먼저 만들어도 괜찮아요.</Text></View>
                )}
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Pressable onPress={() => setStep(1)} style={styles.secondaryButton}><Text style={styles.secondaryText}>이전</Text></Pressable>
                <Pressable disabled={submitting} onPress={handleSubmit} style={[styles.primaryButton, styles.submit, submitting && styles.disabled]}><Text style={styles.primaryText}>{submitting ? '만드는 중…' : '하루 완성하기'}</Text></Pressable>
              </View>
            </>
          )}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.field}><Text accessibilityLabel={required ? `${label}, 필수` : label} style={styles.label}>{label}{required ? <Text style={styles.requiredMark}> *</Text> : null}</Text>{children}</View>;
}

function SelectButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.selectButton}>
      <Text style={styles.selectValue}>{label}</Text>
      <Text style={styles.selectArrow}>⌄</Text>
    </Pressable>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const styles = useThemedStyles(createStyles);
  const [visible, setVisible] = useState(false);
  return (
    <>
      <SelectButton label={value} onPress={() => setVisible(true)} />
      <Modal animationType="slide" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <Pressable onPress={() => setVisible(false)} style={styles.modalBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.timeSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>시간 선택</Text>
              <Pressable accessibilityLabel="시간 선택 닫기" onPress={() => setVisible(false)}><Text style={styles.sheetClose}>×</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.timeGrid} showsVerticalScrollIndicator={false}>
              {TIME_OPTIONS.map((time) => (
                <Pressable
                  accessibilityRole="button"
                  key={time}
                  onPress={() => { onChange(time); setVisible(false); }}
                  style={[styles.timeOption, value === time && styles.timeOptionSelected]}
                >
                  <Text style={[styles.timeOptionText, value === time && styles.timeOptionTextSelected]}>{time}</Text>
                  {value === time ? <Text style={styles.timeOptionCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
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
              textMonthFontWeight: '800',
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
  header: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: spacing.sm },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  back: { color: colors.text, fontSize: 35, lineHeight: 38 },
  close: { color: colors.muted, fontSize: 25 },
  headerTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: 50 },
  progress: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  progressOn: { backgroundColor: palette.primary, borderRadius: 4, flex: 1, height: 4 },
  progressOff: { backgroundColor: colors.border, borderRadius: 4, flex: 1, height: 4 },
  progressText: { color: colors.muted, fontSize: 10, fontWeight: '700', marginLeft: 5 },
  eyebrow: { color: palette.primaryDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: 28 },
  title: { color: colors.text, fontFamily: 'serif', fontSize: 32, fontWeight: '800', lineHeight: 40, marginTop: 9 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  form: { gap: 15, marginTop: 25 },
  field: { gap: 7 },
  label: { color: colors.text, fontSize: 11, fontWeight: '800' },
  requiredMark: { color: palette.primary },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 14, minHeight: 52, paddingHorizontal: 14, paddingVertical: 13 },
  selectButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingHorizontal: 14 },
  selectValue: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '700' },
  selectArrow: { color: colors.muted, fontSize: 18 },
  textarea: { minHeight: 92 },
  row: { flexDirection: 'row', gap: 10 },
  timingCard: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  timingRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 13, paddingVertical: 14, position: 'relative' },
  timingAccent: { borderBottomRightRadius: 3, borderTopRightRadius: 3, bottom: 18, left: 0, position: 'absolute', top: 18, width: 3 },
  timingAccentStart: { backgroundColor: palette.primary, opacity: 0.55 },
  timingAccentEnd: { backgroundColor: palette.primary },
  timingDivider: { backgroundColor: colors.border, height: 1 },
  dateColumn: { flex: 1, minWidth: 0 },
  timeColumn: { flexBasis: 104, flexGrow: 0, flexShrink: 0 },
  error: { color: colors.danger, fontSize: 12, marginTop: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 14, justifyContent: 'center', marginTop: 22, minHeight: 52, paddingHorizontal: 18 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  placeInput: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', marginTop: 23, minHeight: 55, paddingHorizontal: 8 },
  placeTextInput: { color: colors.text, flex: 1, fontSize: 13, paddingHorizontal: 8 },
  addButton: { backgroundColor: palette.primarySoft, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 },
  addButtonText: { color: palette.primaryDark, fontSize: 11, fontWeight: '800' },
  placeList: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, marginTop: 14, overflow: 'hidden', padding: 12 },
  placeRow: { alignItems: 'center', flexDirection: 'row', minHeight: 67, paddingHorizontal: 4 },
  placeNumber: { alignItems: 'center', backgroundColor: palette.primarySoft, borderColor: palette.primary, borderRadius: 15, borderWidth: 1, height: 30, justifyContent: 'center', width: 30 },
  placeNumberText: { color: palette.primaryDark, fontSize: 11, fontWeight: '800' },
  placeCopy: { flex: 1, marginLeft: 12 },
  placeName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  placeMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  remove: { color: colors.muted, fontSize: 22, padding: 8 },
  emptyPlaces: { alignItems: 'center', paddingHorizontal: 15, paddingVertical: 28 },
  emptyPlacesIcon: { color: palette.primary, fontSize: 31 },
  emptyPlacesTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 8 },
  emptyPlacesText: { color: colors.muted, fontSize: 10, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 9 },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 14, borderWidth: 1, justifyContent: 'center', marginTop: 22, minHeight: 52, paddingHorizontal: 20 },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  submit: { flex: 1 },
  disabled: { opacity: 0.5 },
  modalBackdrop: { backgroundColor: 'rgba(40, 35, 33, 0.38)', flex: 1, justifyContent: 'flex-end' },
  calendarSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28, paddingHorizontal: 14, paddingTop: 10 },
  timeSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '72%', paddingBottom: 24, paddingHorizontal: spacing.lg, paddingTop: 10 },
  sheetHeader: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 4 },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sheetClose: { color: colors.muted, fontSize: 28, padding: 8 },
  timeGrid: { gap: 6, paddingTop: 12 },
  timeOption: { alignItems: 'center', borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 48, paddingHorizontal: 16 },
  timeOptionSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  timeOptionText: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '700' },
  timeOptionTextSelected: { color: '#FFFFFF' },
  timeOptionCheck: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
