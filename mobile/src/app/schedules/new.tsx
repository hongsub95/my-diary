import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { createMockSchedule } from '@/features/schedules/schedule-repository';
import { colors, spacing } from '@/shared/theme';
import { seoulDateKey } from '@/shared/utils/date';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function NewScheduleScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const initialDate = useMemo(() => {
    const paramDate = Array.isArray(params.date) ? params.date[0] : params.date;
    return paramDate && DATE_PATTERN.test(paramDate)
      ? paramDate
      : seoulDateKey(new Date().toISOString());
  }, [params.date]);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return setError('일정 제목을 입력해 주세요.');
    if (!DATE_PATTERN.test(date)) return setError('날짜를 YYYY-MM-DD 형식으로 입력해 주세요.');
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
      return setError('시간을 HH:mm 형식으로 입력해 주세요.');
    }
    if (endTime <= startTime) return setError('종료 시간은 시작 시간보다 늦어야 합니다.');
    if (!user?.default_space_id) return setError('일정을 저장할 기본 스페이스가 없습니다.');

    setError(null);
    setSubmitting(true);
    try {
      await createMockSchedule({
        space_id: user.default_space_id,
        space_name: '기본 스페이스',
        title: trimmedTitle,
        description: description.trim(),
        date,
        start_time: startTime,
        end_time: endTime,
        created_by: { id: user.id, nickname: user.nickname },
      });
      await queryClient.invalidateQueries({ queryKey: ['mock-schedules'] });
      router.back();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="뒤로 가기" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>새 일정</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.spaceCard}>
            <Text style={styles.spaceLabel}>저장할 일정방</Text>
            <Text style={styles.spaceName}>기본 스페이스</Text>
          </View>

          <Field label="제목 *">
            <TextInput onChangeText={setTitle} placeholder="일정 이름을 입력하세요" placeholderTextColor={colors.muted} style={styles.input} value={title} />
          </Field>
          <Field label="날짜 *">
            <TextInput autoCapitalize="none" onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} value={date} />
          </Field>
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Field label="시작 시간 *">
                <TextInput onChangeText={setStartTime} placeholder="09:00" placeholderTextColor={colors.muted} style={styles.input} value={startTime} />
              </Field>
            </View>
            <View style={styles.timeField}>
              <Field label="종료 시간 *">
                <TextInput onChangeText={setEndTime} placeholder="10:00" placeholderTextColor={colors.muted} style={styles.input} value={endTime} />
              </Field>
            </View>
          </View>
          <Field label="메모">
            <TextInput multiline onChangeText={setDescription} placeholder="일정에 대한 메모를 남겨보세요" placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} textAlignVertical="top" value={description} />
          </Field>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable disabled={submitting} onPress={handleSubmit} style={({ pressed }) => [styles.submit, pressed && styles.pressed, submitting && styles.disabled]}>
            <Text style={styles.submitText}>{submitting ? '등록 중…' : '일정 추가하기'}</Text>
          </Pressable>
          <Text style={styles.mockNotice}>현재 모바일 일정은 목 데이터에 저장됩니다.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  backText: { color: colors.text, fontSize: 34, lineHeight: 36 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  field: { gap: spacing.sm, marginTop: spacing.lg },
  flex: { flex: 1 },
  header: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 56, paddingHorizontal: spacing.sm },
  headerSpacer: { width: 44 },
  headerTitle: { color: colors.text, flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 50, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  mockNotice: { color: colors.muted, fontSize: 12, marginTop: spacing.md, textAlign: 'center' },
  pressed: { opacity: 0.82 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  spaceCard: { backgroundColor: colors.primarySoft, borderRadius: 14, gap: spacing.xs, padding: spacing.md },
  spaceLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  spaceName: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  submit: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, marginTop: spacing.xl, minHeight: 52, justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  textarea: { minHeight: 112 },
  timeField: { flex: 1 },
  timeRow: { flexDirection: 'row', gap: spacing.md },
});
