import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSpaces } from '@/features/spaces/space-context';
import { createSchedule, getSchedule, updateSchedule } from '@/features/schedules/schedule-api';
import { ScheduleBasicsFields } from '@/features/schedules/schedule-basics-fields';
import { formError, scheduleForm, type ScheduleForm } from '@/features/schedules/schedule-management';
import { StepIndicator } from '@/features/schedules/step-indicator';
import type { Schedule } from '@/shared/api/types';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { LoadingIndicator } from '@/shared/components/loading-indicator';
import { ErrorState } from '@/shared/components/error-state';
import { getApiError } from '@/shared/api/api-error';
import { colors, radii, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
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
  const params = useLocalSearchParams<{ scheduleId?: string | string[] }>();
  const id = Array.isArray(params.scheduleId) ? params.scheduleId[0] : params.scheduleId;
  const query = useQuery({ queryKey: ['schedules', 'step-one', id], queryFn: () => getSchedule(Number(id)), enabled: Boolean(id), staleTime: 0 });
  if (id && query.isPending) return <LoadingScreen message="하루를 불러오고 있어요." />;
  if (id && (query.isError || !query.data)) return <ErrorState message="하루를 불러오지 못했어요. 다시 시도해 주세요." onRetry={() => query.refetch()} />;
  return <ScheduleBasicsForm key={id ?? 'new'} existing={id ? query.data : undefined} />;
}

/**
 * 1단계 폼.
 *
 * @param existing 2단계에서 돌아온 경우의 이미 저장된 하루. 있으면 새로 만들지 않고 고친다
 */
function ScheduleBasicsForm({ existing }: { existing?: Schedule }) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { spaces, spacesQuery, currentSpaceId } = useSpaces();
  const targetSpaceId = existing?.space_id ?? currentSpaceId;
  const targetSpace = spaces.find(space => space.id === targetSpaceId);
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const initialDate = useMemo(() => {
    const value = Array.isArray(params.date) ? params.date[0] : params.date;
    return value && DATE_PATTERN.test(value) ? value : seoulDateKey(new Date().toISOString());
  }, [params.date]);

  const [form, setForm] = useState<ScheduleForm>(() => existing ? scheduleForm(existing) : {
    title: '', description: '', start_date: initialDate, end_date: initialDate, start_time: '12:00', end_time: '15:00',
  });
  const [submitting, setSubmitting] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  // 상태값(submitting)은 다음 렌더에야 반영돼서, 빠르게 두 번 누르면 둘 다 통과한다.
  // 그러면 같은 하루가 둘 생긴다. 즉시 바뀌는 ref로 한 번 더 막는다.
  const submitLock = useRef(false);
  const titleInput = useRef<TextInput>(null);
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();

  /** 저장 전 검사. 고치기 화면과 같은 규칙(formError)에 공간 확인만 더한다. */
  function validate() {
    const invalid = formError(form);
    if (invalid) return invalid;
    if (!targetSpace || spacesQuery.isError) { void spacesQuery.refetch(); return '현재 공간을 확인하지 못했어요. 다시 시도해 주세요.'; }
    return null;
  }

  /** 하루를 저장하고 2단계로 넘어간다. */
  async function saveAndContinue() {
    const invalid = validate();
    if (invalid) {
      showSnackbar(invalid);
      if (invalid.includes('이름')) titleInput.current?.focus();
      return;
    }
    if (submitLock.current) return;
    submitLock.current = true;
    dismissSnackbar();
    setSubmitting(true);
    try {
      const title = form.title.trim();
      const schedule = existing ? await updateSchedule(existing.id, {
        title, description: form.description.trim() || null,
        start_at: new Date(`${form.start_date}T${form.start_time}:00+09:00`).toISOString(),
        end_at: new Date(`${form.end_date}T${form.end_time}:00+09:00`).toISOString(),
      }) : await createSchedule({
        spaceId: targetSpaceId as string,
        title,
        description: form.description.trim(),
        startDate: form.start_date,
        endDate: form.end_date,
        startTime: form.start_time,
        endTime: form.end_time,
      });
      await queryClient.invalidateQueries({ queryKey: ['schedules'] });
      // 단계 이동은 같은 하루 ID를 유지하며 기존 하루는 수정 저장한다.
      router.replace({ pathname: '/schedules/[id]/plan', params: { id: String(schedule.id) } });
    } catch (caught) {
      showSnackbar(getApiError(caught).message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const back = () => existing ? router.replace({ pathname: '/schedules/[id]/plan', params: { id: String(existing.id) } }) : router.back();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {/* 닫기(×)는 두지 않는다. 1단계에서는 뒤로 가기와 같은 동작이라 같은 버튼이 둘이 된다. */}
        <View style={styles.header}>
          <Pressable accessibilityLabel="뒤로 가기" accessibilityRole="button" disabled={submitting} onPress={back} style={styles.headerButton}><Text style={styles.back}>‹</Text></Pressable>
          <Text accessibilityRole="header" style={styles.headerTitle}>하루 만들기</Text>
          <StepIndicator current={1} total={2} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* 저장될 공간과 보는 사람을 늘 보여준다(SPACE_MODEL_SPEC 9.3, 2026-10-13 결정).
              공유 공간을 열어 둔 채 혼자만의 하루를 만들면, 표시가 없을 땐 모르고 함께하는
              사람에게 보이게 된다. 고르는 칸은 두지 않는다 — 다른 곳에 저장하려면 공간을
              바꾼 뒤 만든다. */}
          {targetSpace ? (
            <View style={styles.spaceTarget}>
              <View style={styles.spaceDot} />
              <Text style={styles.spaceText}>
                <Text style={styles.spaceName}>{targetSpace.name}</Text>에 저장돼요 ·{' '}
                {targetSpace.type === 'shared' ? `${targetSpace.member_count}명이 함께 봐요` : '나만 볼 수 있어요'}
              </Text>
            </View>
          ) : null}
          <ScheduleBasicsFields
            ref={titleInput}
            disabled={submitting}
            form={form}
            onChange={patch => setForm(before => ({ ...before, ...patch }))}
          />
        </ScrollView>

        {/* 다음 단계 버튼은 스크롤과 상관없이 아래에 고정한다. 작은 화면에서도 내려 찾지 않게 한다. */}
        <View onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={styles.footer}>
          <Pressable accessibilityRole="button" disabled={submitting} onPress={saveAndContinue} style={[styles.primaryButton, submitting && styles.disabled]}>
            {submitting ? <LoadingIndicator variant="ring" message="하루를 만드는 중…" inline color="#fff" textStyle={styles.primaryText} /> : <Text style={styles.primaryText}>갈 곳 정하기  →</Text>}
          </Pressable>
        </View>
        {/* 고정 버튼에 가리지 않게 스낵바를 그 위에 띄운다. */}
        <View pointerEvents="box-none" style={[styles.snackbarLayer, { bottom: footerHeight }]}>
          <Snackbar notice={notice} onDismiss={dismissSnackbar} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.background, flexDirection: 'row', minHeight: 56, paddingLeft: spacing.sm },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  back: { color: colors.text, fontSize: 35, lineHeight: 38 },
  headerTitle: { color: colors.text, flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  content: { paddingBottom: 32, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  // 저장될 공간. 입력칸이 아니라 안내라서 칸처럼 보이지 않게 연한 바탕만 둔다.
  spaceTarget: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: palette.primarySoft, borderRadius: 12, flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 9 },
  spaceDot: { backgroundColor: palette.primary, borderRadius: 3, height: 6, width: 6 },
  spaceText: { color: colors.muted, flexShrink: 1, fontSize: 13, lineHeight: 19 },
  spaceName: { color: palette.primaryDark, fontWeight: '600' },
  footer: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 12, paddingHorizontal: spacing.lg, paddingTop: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: radii.lg, elevation: 2, justifyContent: 'center', minHeight: 54, paddingHorizontal: 18, shadowColor: palette.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  snackbarLayer: { left: 0, position: 'absolute', right: 0 },
});
