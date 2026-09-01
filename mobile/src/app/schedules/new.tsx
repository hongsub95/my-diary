import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { addSchedulePlace, createSchedule } from '@/features/schedules/schedule-api';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing } from '@/shared/theme';
import { seoulDateKey } from '@/shared/utils/date';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type DraftPlace = { id: number; name: string };

export default function NewScheduleScreen() {
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
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('20:30');
  const [description, setDescription] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [places, setPlaces] = useState<DraftPlace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateBasics() {
    if (!title.trim()) return '하루의 이름을 입력해 주세요.';
    if (!DATE_PATTERN.test(date)) return '날짜를 YYYY-MM-DD 형식으로 입력해 주세요.';
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) return '시간을 HH:mm 형식으로 입력해 주세요.';
    if (endTime <= startTime) return '종료 시간은 시작 시간보다 늦어야 해요.';
    if (!user?.default_space_id) return '하루를 저장할 기본 스페이스가 없어요.';
    return null;
  }

  function moveNext() {
    const validation = validateBasics();
    if (validation) return setError(validation);
    setError(null);
    setStep(2);
  }

  function addPlace() {
    const name = placeName.trim();
    if (!name) return;
    setPlaces((current) => [...current, { id: Date.now(), name }]);
    setPlaceName('');
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
        date,
        startTime,
        endTime,
      });
      await Promise.all(places.map((place) => addSchedulePlace(schedule.id, { name: place.name })));
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
                <Field label="하루의 이름">
                  <TextInput onChangeText={setTitle} placeholder="예: 성수 전시와 저녁" placeholderTextColor={colors.muted} style={styles.input} value={title} />
                </Field>
                <View style={styles.row}>
                  <View style={styles.flex}><Field label="날짜"><TextInput onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} value={date} /></Field></View>
                </View>
                <View style={styles.row}>
                  <View style={styles.flex}><Field label="시작"><TextInput onChangeText={setStartTime} placeholder="14:00" placeholderTextColor={colors.muted} style={styles.input} value={startTime} /></Field></View>
                  <View style={styles.flex}><Field label="종료"><TextInput onChangeText={setEndTime} placeholder="20:30" placeholderTextColor={colors.muted} style={styles.input} value={endTime} /></Field></View>
                </View>
                <Field label="한 줄 메모 · 선택">
                  <TextInput multiline onChangeText={setDescription} placeholder="전시 보고 저녁 먹기. 서두르지 않기." placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} textAlignVertical="top" value={description} />
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

              <View style={styles.placeInput}>
                <TextInput onChangeText={setPlaceName} onSubmitEditing={addPlace} placeholder="카페, 전시, 식당 이름을 입력하세요" placeholderTextColor={colors.muted} returnKeyType="done" style={styles.placeTextInput} value={placeName} />
                <Pressable onPress={addPlace} style={styles.addButton}><Text style={styles.addButtonText}>추가</Text></Pressable>
              </View>

              <View style={styles.placeList}>
                {places.length ? places.map((place, index) => (
                  <View key={place.id} style={styles.placeRow}>
                    <View style={styles.placeNumber}><Text style={styles.placeNumberText}>{index + 1}</Text></View>
                    <View style={styles.placeCopy}><Text style={styles.placeName}>{place.name}</Text><Text style={styles.placeMeta}>상세 주소와 시간은 나중에 추가할 수 있어요.</Text></View>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: spacing.sm },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  back: { color: colors.text, fontSize: 35, lineHeight: 38 },
  close: { color: colors.muted, fontSize: 25 },
  headerTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: 50 },
  progress: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  progressOn: { backgroundColor: colors.primary, borderRadius: 4, flex: 1, height: 4 },
  progressOff: { backgroundColor: colors.border, borderRadius: 4, flex: 1, height: 4 },
  progressText: { color: colors.muted, fontSize: 10, fontWeight: '700', marginLeft: 5 },
  eyebrow: { color: colors.primaryDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: 28 },
  title: { color: colors.text, fontFamily: 'serif', fontSize: 32, fontWeight: '800', lineHeight: 40, marginTop: 9 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  form: { gap: 15, marginTop: 25 },
  field: { gap: 7 },
  label: { color: colors.text, fontSize: 11, fontWeight: '800' },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 14, minHeight: 52, paddingHorizontal: 14, paddingVertical: 13 },
  textarea: { minHeight: 92 },
  row: { flexDirection: 'row', gap: 10 },
  error: { color: colors.danger, fontSize: 12, marginTop: 14 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, justifyContent: 'center', marginTop: 22, minHeight: 52, paddingHorizontal: 18 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  placeInput: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', marginTop: 23, minHeight: 55, paddingHorizontal: 8 },
  placeTextInput: { color: colors.text, flex: 1, fontSize: 13, paddingHorizontal: 8 },
  addButton: { backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 },
  addButtonText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  placeList: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, marginTop: 14, overflow: 'hidden', padding: 12 },
  placeRow: { alignItems: 'center', flexDirection: 'row', minHeight: 67, paddingHorizontal: 4 },
  placeNumber: { alignItems: 'center', backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 15, borderWidth: 1, height: 30, justifyContent: 'center', width: 30 },
  placeNumberText: { color: colors.primaryDark, fontSize: 11, fontWeight: '800' },
  placeCopy: { flex: 1, marginLeft: 12 },
  placeName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  placeMeta: { color: colors.muted, fontSize: 9, marginTop: 4 },
  remove: { color: colors.muted, fontSize: 22, padding: 8 },
  emptyPlaces: { alignItems: 'center', paddingHorizontal: 15, paddingVertical: 28 },
  emptyPlacesIcon: { color: colors.primary, fontSize: 31 },
  emptyPlacesTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginTop: 8 },
  emptyPlacesText: { color: colors.muted, fontSize: 10, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 9 },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 14, borderWidth: 1, justifyContent: 'center', marginTop: 22, minHeight: 52, paddingHorizontal: 20 },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  submit: { flex: 1 },
  disabled: { opacity: 0.5 },
});
