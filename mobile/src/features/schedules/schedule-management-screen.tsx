import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/auth-context';
import { listDiaryTimeline } from '@/features/diaries/diary-api';
import { seoulDateKey } from '@/shared/utils/date';
import { SpaceButton } from '@/features/spaces/space-ui';
import { getApiError } from '@/shared/api/api-error';
import type { Schedule } from '@/shared/api/types';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { deleteSchedule, getSchedule, updateSchedule, type UpdateScheduleInput } from './schedule-api';
import { errorStatus, formError, periodLabel, sameField, scheduleChanges, scheduleForm, scheduleWhen, useScheduleAccess, type ScheduleForm } from './schedule-management';
import { ScheduleDatePicker } from './schedule-date-picker';
import { SelectButton, TimeSelect } from './time-select';

type Mode = 'edit' | 'delete';
type Access = ReturnType<typeof useScheduleAccess>;

export function ScheduleManagementScreen({ mode }: { mode: Mode }) {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const { user, status } = useAuth();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const query = useQuery({
    queryKey: ['schedules', 'manage', user?.id, id], queryFn: () => getSchedule(id),
    enabled: Boolean(user && Number.isInteger(id) && id > 0), staleTime: 0, retry: false, refetchOnMount: 'always',
  });
  const access = useScheduleAccess(query.data);
  if (status === 'anonymous') return <Redirect href="/(auth)/login" />;
  const blocked = errorStatus(query.error) === 404 || errorStatus(access.space.error) === 404;
  if (!Number.isInteger(id) || id < 1 || query.isError || access.space.isError) {
    return <SafeAreaView style={styles.screen}><View style={styles.body}><Text style={styles.title}>{mode === 'edit' ? '일정 고치기' : '일정 지우기'}</Text>
      <Text style={styles.text}>{blocked ? '일정을 찾을 수 없거나 접근할 수 없어요.' : '일정을 불러오지 못했어요.'}</Text>
      {!blocked && <SpaceButton onPress={() => { void query.refetch(); void access.space.refetch(); }}>다시 불러오기</SpaceButton>}
      <SpaceButton onPress={() => router.replace('/(tabs)/schedules')}>일정 목록으로</SpaceButton></View></SafeAreaView>;
  }
  if (query.isPending || (query.isFetching && !query.isFetchedAfterMount) || !access.canEdit) {
    return <SafeAreaView style={styles.screen}><View style={styles.body}><Text accessibilityRole="text" style={styles.text}>일정을 불러오고 있어요.</Text></View></SafeAreaView>;
  }
  return <ManagementForm key={user!.id + ':' + id + ':' + mode} schedule={query.data} access={access} mode={mode} />;
}

function ManagementForm({ schedule, access, mode }: { schedule: Schedule; access: Access; mode: Mode }) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const client = useQueryClient();
  const [original, setOriginal] = useState(schedule);
  const [form, setForm] = useState(() => scheduleForm(schedule));
  const [busy, setBusy] = useState(false);
  const [destination, setDestination] = useState<{ list: boolean; notice?: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(null);
  const [conflict, setConflict] = useState<Schedule | null>(null);
  const [calendar, setCalendar] = useState<'start' | 'end' | null>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  const lock = useRef(false);
  const alive = useRef(true);
  const titleInput = useRef<TextInput>(null);
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();
  const isEdit = mode === 'edit';
  const dirty = JSON.stringify(form) !== JSON.stringify(scheduleForm(original));
  usePreventRemove(!destination && (busy || (isEdit && dirty)), ({ data }) => {
    if (!lock.current) setPendingAction(data.action);
  });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!destination) return;
    if (destination.list) router.replace({ pathname: '/(tabs)/schedules', params: { notice: destination.notice } });
    else router.replace({ pathname: '/schedules/[id]', params: { id: String(schedule.id), notice: destination.notice } });
  }, [destination, router, schedule.id]);

  async function refresh(deleted = false) {
    const keys = ['schedules', 'diaries', 'diary', 'collection'];
    if (deleted) {
      await Promise.all(keys.map(key => client.cancelQueries({ queryKey: [key] })));
      keys.forEach(key => client.removeQueries({ queryKey: [key] }));
    } else await Promise.all(keys.map(key => client.invalidateQueries({ queryKey: [key] })));
  }
  async function unavailable() {
    await refresh(true);
    if (alive.current) setDestination({ list: true, notice: '일정을 찾을 수 없거나 접근할 수 없어요. 목록을 확인해 주세요.' });
  }
  const back = () => router.replace({ pathname: '/schedules/[id]', params: { id: String(schedule.id) } });
  const set = (key: keyof ScheduleForm, value: string) => setForm(before => ({ ...before, [key]: value }));

  async function save() {
    if (lock.current || destination) return;
    const invalid = formError(form);
    if (invalid) { showSnackbar(invalid); if (invalid.includes('이름')) titleInput.current?.focus(); return; }
    const changes = scheduleChanges(form, original);
    const fields = Object.keys(changes) as (keyof UpdateScheduleInput)[];
    if (!fields.length) { setDestination({ list: false }); return; }
    lock.current = true; setBusy(true); dismissSnackbar();
    try {
      const latest = await getSchedule(schedule.id);
      if (!alive.current) return;
      if (fields.some(field => !sameField(field, latest[field], original[field]))) { setConflict(latest); return; }
      if (changes.start_at || changes.end_at) {
        const timeline = await listDiaryTimeline(schedule.id);
        if (!alive.current) return;
        if (timeline.some(item => { const date = seoulDateKey(item.occurred_at); return date < form.start_date || date > form.end_date; })) {
          showSnackbar('범위 밖에 남긴 기록이 있어요. 타임라인 날짜를 고치거나 일정 기간을 다시 선택해 주세요.');
          return;
        }
      }
      let updated: Schedule | undefined;
      try { updated = await updateSchedule(schedule.id, changes); }
      catch (caught) {
        if (!errorStatus(caught) || errorStatus(caught)! >= 500) {
          const check = await getSchedule(schedule.id).catch(() => null);
          if (check && fields.every(field => sameField(field, check[field], changes[field]))) updated = check;
        }
        if (!updated) throw caught;
      }
      if (!alive.current) return;
      await refresh();
      if (alive.current) setDestination({ list: false, notice: '일정을 고쳤어요.' });
    } catch (caught) {
      if (!alive.current) return;
      if (errorStatus(caught) === 404) await unavailable();
      else showSnackbar(getApiError(caught).message);
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }

  async function remove() {
    if (lock.current || !access.canDelete || destination) return;
    lock.current = true; setBusy(true); dismissSnackbar();
    try {
      await deleteSchedule(schedule.id);
      if (!alive.current) return;
      await refresh(true);
      if (alive.current) setDestination({ list: true, notice: '일정을 지웠어요.' });
    } catch (caught) {
      if (!alive.current) return;
      if (errorStatus(caught) === 403) {
        await access.space.refetch();
        showSnackbar('일정 작성자나 공간 소유자만 지울 수 있어요.');
      } else if (errorStatus(caught) === 404) await unavailable();
      else if (!errorStatus(caught) || errorStatus(caught)! >= 500) {
        try { await getSchedule(schedule.id); showSnackbar('지우지 못했어요. 연결을 확인하고 다시 시도해 주세요.'); }
        catch (check) { if (errorStatus(check) === 404) await unavailable(); else showSnackbar('삭제 결과를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'); }
      } else showSnackbar(getApiError(caught).message);
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }

  function keepDraft() {
    if (!conflict) return;
    const before = scheduleForm(original);
    const latest = scheduleForm(conflict);
    setForm(draft => ({ ...latest, ...Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== before[key as keyof ScheduleForm])) }));
    setOriginal(conflict); setConflict(null);
  }
  const shared = access.space.data?.type === 'shared';
  return <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" disabled={busy || !!destination} onPress={back} style={styles.back}><Text style={styles.backMark}>‹</Text></Pressable><Text accessibilityRole="header" style={styles.headerTitle}>{isEdit ? '일정 고치기' : '일정 지우기'}</Text><View style={styles.back} /></View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}><Text style={styles.eyebrow}>{isEdit ? 'EDIT YOUR DAY' : 'DELETE YOUR DAY'}</Text><Text accessibilityRole="header" style={styles.title}>{isEdit ? '계획이 바뀌었나요?' : '이 일정을 지울까요?'}</Text><Text style={styles.text}>{isEdit ? '저장해 둔 하루의 정보를 고쳐주세요.' : '지우기 전에 어떤 하루인지 확인해 주세요.'}</Text></View>
        {isEdit ? <>
          <View style={styles.card}><Text style={styles.hint}>저장된 공간</Text><Text style={styles.name}>{schedule.space_name}</Text>{shared && <Text style={styles.hint}>함께 쓰는 공간의 일정은 변경 내용이 모두에게 보여요.</Text>}</View>
          <View style={styles.field}><Text style={styles.label}>하루의 이름 *</Text><TextInput ref={titleInput} accessibilityLabel="하루의 이름, 필수" editable={!busy} style={styles.input} value={form.title} onChangeText={value => set('title', value)} /></View>
          <View style={styles.card}>{(['start', 'end'] as const).map(edge => <View key={edge} style={styles.timingRow}>
            <View style={styles.dateField}><Text style={styles.label}>{edge === 'start' ? '시작일' : '종료일'} *</Text><SelectButton disabled={busy} accessibilityLabel={edge === 'start' ? '시작일 선택' : '종료일 선택'} label={form[edge + '_date' as keyof ScheduleForm]} onPress={() => setCalendar(edge)} /></View>
            <View style={styles.timeField}><Text style={styles.label}>{edge === 'start' ? '시작 시간' : '종료 시간'} *</Text><TimeSelect disabled={busy} accessibilityLabel={edge === 'start' ? '시작 시간 선택' : '종료 시간 선택'} value={form[edge + '_time' as keyof ScheduleForm]} onChange={value => set(edge + '_time' as keyof ScheduleForm, value)} /></View>
          </View>)}<Text style={styles.period}>{periodLabel(form)}</Text></View>
          <View style={styles.field}><Text style={styles.label}>메모</Text><TextInput accessibilityLabel="메모" editable={!busy} multiline textAlignVertical="top" style={[styles.input, styles.textarea]} value={form.description} onChangeText={value => set('description', value)} /></View>
          <Text style={styles.hint}>담아 둔 장소와 사진·글·타임라인은 그대로 남아요.</Text>
        </> : <>
          <View style={styles.card}><Text style={styles.hint}>{schedule.space_name}</Text><Text style={styles.title}>{schedule.title}</Text><Text style={styles.text}>{scheduleWhen(schedule)}</Text>
            <View style={styles.tags}><Text style={styles.tag}>장소 {schedule.place_count}곳</Text><Text style={styles.tag}>사진 {schedule.record_summary.photo_count}장</Text><Text style={styles.tag}>글 {schedule.record_summary.has_diary_text ? '있음' : '없음'}</Text><Text style={styles.tag}>타임라인 {schedule.record_summary.timeline_count}개</Text></View></View>
          <View style={styles.intro}><Text style={styles.name}>연결된 기록도 함께 지워져요</Text><Text style={styles.text}>이 일정과 연결된 장소·사진·글·타임라인이 함께 지워져요. 앱에서 되돌릴 수 없어요.</Text>{shared && <Text style={styles.text}>함께 남긴 다른 사람의 기록도 지워지고, 모든 멤버의 화면에서 사라져요.</Text>}</View>
          {!access.canDelete && <Text style={styles.hint}>일정 작성자나 공간 소유자만 지울 수 있어요.</Text>}
        </>}
      </ScrollView>
      <View style={styles.footer} onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}>
        {isEdit ? <SpaceButton kind="primary" disabled={busy || !dirty || !!destination} onPress={() => { void save(); }}>{busy ? '저장 중…' : '저장하기'}</SpaceButton> : <>
          <SpaceButton disabled={busy || !!destination} onPress={back}>돌아가기</SpaceButton>
          {access.canDelete && <SpaceButton kind="danger" disabled={busy || !!destination} onPress={() => { void remove(); }}>{busy ? '지우는 중…' : '일정 지우기'}</SpaceButton>}
        </>}
      </View>
      <ScheduleDatePicker target={calendar} startDate={form.start_date} endDate={form.end_date} onClose={() => setCalendar(null)} onSelect={date => { if (calendar) set(calendar + '_date' as keyof ScheduleForm, date); setCalendar(null); }} />
      <Modal transparent visible={!!pendingAction || !!conflict} onRequestClose={() => { setPendingAction(null); if (conflict) keepDraft(); }}>
        <View style={styles.scrim}><View accessibilityViewIsModal style={styles.dialog}>
          <Text accessibilityRole="header" style={styles.name}>{pendingAction ? '변경 내용을 저장하지 않고 나갈까요?' : '다른 사람이 일정을 고쳤어요.'}</Text>
          <Text style={styles.text}>{pendingAction ? '고친 내용은 저장되지 않아요.' : '최신 내용을 불러오면 입력 중인 내용이 바뀌어요.'}</Text>
          <SpaceButton onPress={() => { if (pendingAction) setPendingAction(null); else keepDraft(); }}>{pendingAction ? '계속 고치기' : '내 입력 유지'}</SpaceButton>
          <SpaceButton kind="danger" onPress={() => {
            if (pendingAction) { const action = pendingAction; setPendingAction(null); navigation.dispatch(action); }
            else if (conflict) { setOriginal(conflict); setForm(scheduleForm(conflict)); setConflict(null); }
          }}>{pendingAction ? '저장하지 않고 나가기' : '최신 내용 불러오기'}</SpaceButton>
        </View></View>
      </Modal>
      <View pointerEvents="box-none" style={{ position: 'absolute', bottom: footerHeight, left: 0, right: 0 }}><Snackbar notice={notice} onDismiss={dismissSnackbar} /></View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  footer: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  back: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, backMark: { color: colors.text, fontSize: 32 }, headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { padding: 20, paddingBottom: 40, gap: 20, width: '100%', maxWidth: 720, alignSelf: 'center' },
  intro: { gap: 10, paddingVertical: 8 }, eyebrow: { color: palette.primaryDark, fontSize: 12 }, title: { color: colors.text, fontSize: 26, lineHeight: 36, fontWeight: '600' },
  text: { color: colors.muted, fontSize: 14, lineHeight: 23 }, hint: { color: colors.muted, fontSize: 12, lineHeight: 20 }, name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  card: { borderRadius: 24, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 16, gap: 14 },
  field: { gap: 8 }, label: { color: colors.text, fontSize: 14, fontWeight: '600' }, input: { borderRadius: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, minHeight: 52, padding: 14, fontSize: 14, color: colors.text }, textarea: { minHeight: 110 },
  timingRow: { flexDirection: 'row', gap: 10 }, dateField: { flex: 1, minWidth: 0, gap: 8 }, timeField: { width: 100, gap: 8 }, period: { color: palette.primaryDark, fontSize: 12, textAlign: 'right' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tag: { backgroundColor: colors.surfaceMuted, borderRadius: 8, padding: 8, fontSize: 12, color: colors.muted },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'center', padding: 24 }, dialog: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, gap: 16 },
});
