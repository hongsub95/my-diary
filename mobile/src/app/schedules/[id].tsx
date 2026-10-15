import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiarySection } from '@/features/diaries/diary-section';
import { PlacePicker } from '@/features/places/place-picker';
import { KakaoMap } from '@/features/places/kakao-map';
import { OptimizeSuggestion } from '@/features/schedules/optimize-suggestion';
import { PlaceNoteEditor } from '@/features/schedules/place-note-editor';
import { useSchedule, useScheduleActions } from '@/features/schedules/schedule-queries';
import type { SchedulePlaceView } from '@/features/schedules/schedule-adapter';
import { getApiError } from '@/shared/api/api-error';
import { moveItem } from '@/shared/utils/reorder';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { colors, radii, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import { SpaceButton } from '@/features/spaces/space-ui';
import { scheduleWhen, useScheduleAccess } from '@/features/schedules/schedule-management';

const PHASE_LABELS: Record<string, string> = {
  upcoming: '예정',
  today: '오늘',
  record_pending: '기록을 기다리는 중',
  recorded: '기록함',
  canceled: '취소됨',
};

/**
 * 장소 목록. 당일에는 방문 체크를 함께 보여준다.
 *
 * @param checkable 방문 체크를 쓸 수 있는지. 당일에만 켠다. 예정 화면에서
 *   "다녀왔어요"는 뜻이 통하지 않는다
 */
function PlaceList({
  places,
  checkable,
  removable,
  reorderable,
  editable,
  onToggle,
  onRemove,
  onMove,
  onSaveNote,
  busy,
}: {
  places: SchedulePlaceView[];
  checkable: boolean;
  removable: boolean;
  /** 순서를 바꿀 수 있는지. 아직 오지 않은 하루에만 켠다 */
  reorderable: boolean;
  /** 예정시각·메모를 고칠 수 있는지. 끝난 하루에서는 보여주기만 한다 */
  editable: boolean;
  onToggle: (place: SchedulePlaceView) => void;
  onRemove: (place: SchedulePlaceView) => void;
  onMove: (index: number, step: number) => void;
  onSaveNote: (
    place: SchedulePlaceView,
    note: { plannedTime: string | null; memo: string | null },
  ) => Promise<unknown>;
  busy: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.placeList}>
      {places.map((place, index) => (
        <View key={place.id} style={styles.place}>
          {/* 화면에는 방문 차례를 1부터 보여준다. sortOrder는 0부터 시작하는 내부 값이다. */}
          <Text style={[styles.placeOrder, place.visited && styles.placeOrderDone]}>
            {index + 1}
          </Text>
          <View style={styles.placeBody}>
            <Text style={[styles.placeName, place.visited && styles.placeNameDone]}>
              {place.name}
            </Text>
            {place.address ? <Text style={styles.placeAddress}>{place.address}</Text> : null}
            <PlaceNoteEditor
              placeName={place.name}
              plannedTime={place.plannedTime}
              memo={place.memo}
              editable={editable}
              busy={busy}
              onSave={(note) => onSaveNote(place, note)}
            />
          </View>
          {/* 순서 바꾸기는 아직 오지 않은 하루에만 둔다. 당일이나 끝난 하루의 순서를
              바꾸는 것은 기록을 고치는 일이라 뜻이 다르다. */}
          {reorderable ? (
            <View style={styles.moves}>
              <Pressable
                accessibilityLabel={`${place.name} 순서 올리기`}
                disabled={busy || index === 0}
                onPress={() => onMove(index, -1)}
                style={styles.moveButton}>
                <Text style={[styles.moveMark, index === 0 && styles.moveMarkOff]}>↑</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`${place.name} 순서 내리기`}
                disabled={busy || index === places.length - 1}
                onPress={() => onMove(index, 1)}
                style={styles.moveButton}>
                <Text
                  style={[styles.moveMark, index === places.length - 1 && styles.moveMarkOff]}>
                  ↓
                </Text>
              </Pressable>
            </View>
          ) : null}

          {checkable ? (
            <Pressable onPress={() => onToggle(place)} disabled={busy} style={styles.visitButton}>
              <Text style={styles.visitText}>{place.visited ? '취소' : '다녀왔어요'}</Text>
            </Pressable>
          ) : removable ? (
            <Pressable
              accessibilityLabel={`${place.name} 빼기`}
              onPress={() => onRemove(place)}
              disabled={busy}>
              <Text style={styles.removeMark}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * 하루 상세. 공통 요약 아래에서 장소·계획과 사진·기록을 전환한다.
 *
 * - 예정: 장소 흐름이 먼저다. 어디를 어떤 순서로 갈지 정하는 화면이다
 * - 당일: 다음 장소와 진행 상태가 먼저다. 지금 뭘 하면 되는지만 보면 된다
 * - 기록 있는 지난 하루: 사진·기록 탭을 먼저 연다. 탭 선택과 작성 중 입력은 유지한다
 *
 * 기준은 docs/UX_IDENTITY_REDIRECTION_SPEC.md 7절과
 * docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 3.3~3.5절이며, 웹과 같은 규칙이다.
 */
export default function ScheduleDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; notice?: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const scheduleId = Number(rawId);

  const schedule = useSchedule(scheduleId);
  const access = useScheduleAccess(schedule.data);
  const {
    complete,
    toggleVisited,
    addPlace,
    removePlace,
    updatePlaceNote,
    reorderPlaces,
    optimizePlaces,
  } = useScheduleActions(scheduleId);
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();
  useEffect(() => {
    if (typeof params.notice === 'string' && params.notice) { showSnackbar(params.notice); router.setParams({ notice: undefined }); }
  }, [params.notice, router, showSnackbar]);
  const [picking, setPicking] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [selection, setSelection] = useState<{ id: number; tab: 'plan' | 'record' } | null>(null);
  const defaultTab = schedule.data && ['recorded', 'record_pending'].includes(schedule.data.experience_phase)
    && schedule.data.record_summary.has_content ? 'record' : 'plan';
  const activeTab = selection?.id === scheduleId ? selection.tab : defaultTab;
  // 처음 불러온 하루에서만 기본 탭을 정한다. 기록 저장 후 재조회돼도 사용자의 선택을 유지한다.
  if (schedule.data && selection?.id !== scheduleId) {
    setSelection({ id: scheduleId, tab: defaultTab });
  }

  if (schedule.isLoading) return <LoadingScreen message="하루를 불러오고 있어요." />;
  if (schedule.isError || access.space.isError || !schedule.data) {
    return (
      <ErrorState
        message={schedule.error ? getApiError(schedule.error).message : '일정을 찾을 수 없습니다.'}
        onRetry={() => schedule.refetch()}
      />
    );
  }

  const day = schedule.data;
  const phase = day.experience_phase;
  const isToday = phase === 'today';
  // 다녀왔거나 완료한 하루에서는 기존 장소 계획 편집을 제한한다.
  const isDone = phase === 'recorded' || phase === 'record_pending';
  const visited = day.places.filter((place) => place.visited).length;
  const nextPlace = day.places.find((place) => !place.visited) ?? null;

  async function run(action: () => Promise<unknown>) {
    dismissSnackbar();
    try {
      await action();
    } catch (caught) {
      showSnackbar(getApiError(caught).message);
    }
  }

  const placesSection = (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        {/* 완료한 하루에는 계획을 더 담지 않는다. 그날 있었던 일은 방문 기록으로 남긴다. */}
        <Text style={styles.sectionTitle}>{isDone ? '다녀온 장소' : '장소'}</Text>
        {day.status === 'planned' && ['upcoming', 'today'].includes(phase) ? (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/schedules/[id]/recommendations', params: { id: String(scheduleId) } })} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={styles.action}>코스 추천</Text>
          </Pressable>
        ) : null}
        {!isDone && !picking ? (
          <Pressable onPress={() => setPicking(true)}>
            <Text style={styles.action}>+ 추가</Text>
          </Pressable>
        ) : null}
      </View>

      {picking ? (
        <>
          <PlacePicker
            busy={addPlace.isPending}
            onNotice={showSnackbar}
            onPick={(place) => addPlace.mutateAsync(place)}
          />
          <Pressable onPress={() => setPicking(false)} style={styles.closePicker}>
            <Text style={styles.action}>닫기</Text>
          </Pressable>
        </>
      ) : null}

      {activeTab === 'plan' && day.places.length > 0 ? (
        <KakaoMap places={day.places.map(place => ({ ...place, id: String(place.id) }))} />
      ) : null}

      {/* 순서를 바꿀 수 있는 하루에만 둔다. 목록 바로 위에 두어 "아래 순서를 다듬는
          버튼"이라는 것이 읽히게 한다. */}
      {!isDone && !isToday && day.places.length > 0 ? (
        <OptimizeSuggestion
          places={day.places}
          busy={optimizePlaces.isPending || reorderPlaces.isPending}
          onRequest={() => optimizePlaces.mutateAsync()}
          onApply={(schedulePlaceIds) => reorderPlaces.mutateAsync(schedulePlaceIds)}
        />
      ) : null}

      {day.places.length > 0 ? (
        <PlaceList
          places={day.places}
          checkable={isToday}
          // 방문 체크가 켜진 당일에는 빼기 버튼을 두지 않는다. 두 버튼이 같은 자리에
          // 겹치면 다녀온 곳을 지우려다 잘못 누르기 쉽다.
          removable={!isDone && !isToday}
          reorderable={!isDone && !isToday}
          // 순서와 달리 시각·메모는 당일에도 고친다. "5시로 미뤘다" 같은 변경이 가장
          // 자주 일어나는 날이 바로 그날이다.
          editable={!isDone}
          busy={
            toggleVisited.isPending ||
            removePlace.isPending ||
            reorderPlaces.isPending ||
            updatePlaceNote.isPending
          }
          onToggle={(place) =>
            run(() =>
              toggleVisited.mutateAsync({ schedulePlaceId: place.id, visited: !place.visited }),
            )
          }
          onRemove={(place) => run(() => removePlace.mutateAsync(place.id))}
          onSaveNote={(place, note) =>
            updatePlaceNote.mutateAsync({ schedulePlaceId: place.id, ...note })
          }
          onMove={(index, step) => {
            // 서버에는 바뀐 전체 순서를 보낸다(API_SPEC 6.4절). 끝에서 더 못 가면
            // moveItem이 원본을 그대로 돌려주므로 요청하지 않는다.
            const next = moveItem(day.places, index, step);
            if (next === day.places) return;
            run(() => reorderPlaces.mutateAsync(next.map((place) => place.id)));
          }}
        />
      ) : !picking ? (
        <Text style={styles.empty}>
          {isDone ? '담아둔 장소가 없었어요.' : '아직 담은 장소가 없어요.'}
        </Text>
      ) : null}
    </View>
  );

  const diarySection = (
    <DiarySection scheduleId={scheduleId} dateKey={day.dateKey} places={day.places} onNotice={showSnackbar} />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backMark}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>하루 상세</Text>
        {access.canEdit ? (
          <Pressable accessibilityRole="button" accessibilityLabel="일정 관리" accessibilityState={{ expanded: managementOpen }} onPress={() => setManagementOpen(open => !open)} style={styles.backButton}>
            <Text style={styles.backMark}>⋯</Text>
          </Pressable>
        ) : <View style={styles.backButton} />}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.phase}>
            {PHASE_LABELS[phase] ?? phase} · {day.space_name}
          </Text>
          <Text style={styles.title}>{day.title}</Text>
          <Text style={styles.when}>{scheduleWhen(day)}</Text>
        </View>

        {access.canEdit && managementOpen && <View style={styles.section}>
          <Text style={styles.sectionTitle}>일정 관리</Text>
          <SpaceButton onPress={() => router.push({ pathname: '/schedules/[id]/edit', params: { id: String(scheduleId) } })}>일정 고치기</SpaceButton>
          {access.canDelete && <SpaceButton kind="danger" onPress={() => router.push({ pathname: '/schedules/[id]/delete', params: { id: String(scheduleId) } })}>일정 지우기</SpaceButton>}
        </View>}

        <View accessibilityRole="tablist" style={styles.tabs}>
          {([{ key: 'plan', label: '장소·계획' }, { key: 'record', label: '사진·기록' }] as const).map(tab => (
            <Pressable key={tab.key} accessibilityRole="tab" aria-selected={activeTab === tab.key} accessibilityState={{ selected: activeTab === tab.key }} onPress={() => setSelection({ id: scheduleId, tab: tab.key })} style={[styles.tab, activeTab === tab.key && styles.tabActive]}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 숨겨도 마운트를 유지해 장소 메모·일기·방문 기록의 입력값을 보존한다. */}
        <View style={[styles.panel, activeTab !== 'plan' && styles.hidden]} accessibilityElementsHidden={activeTab !== 'plan'} importantForAccessibility={activeTab === 'plan' ? 'auto' : 'no-hide-descendants'}>
        {isToday && day.places.length > 0 ? (
          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>
              {nextPlace ? '다음 장소' : '모든 장소를 다녀왔어요'}
            </Text>
            {nextPlace ? <Text style={styles.nextName}>{nextPlace.name}</Text> : null}
            <Text style={styles.nextProgress}>
              {visited} / {day.places.length}곳 방문
            </Text>
          </View>
        ) : null}

        {placesSection}

        {day.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>메모</Text>
            <Text style={styles.memo}>{day.description}</Text>
          </View>
        ) : null}

        {/* 완료 처리는 계획에서 기억으로 넘어가는 전환이다. 아직 안 넘어간 하루에만 둔다. */}
        {!isDone && phase !== 'canceled' ? (
          <Pressable
            onPress={() => run(() => complete.mutateAsync())}
            disabled={complete.isPending}
            style={({ pressed }) => [styles.completeButton, pressed && styles.pressed]}>
            <Text style={styles.completeText}>
              {complete.isPending ? '처리 중…' : '하루 마치기'}
            </Text>
          </Pressable>
        ) : null}
        </View>

        <View key={`record-${scheduleId}`} style={[styles.panel, activeTab !== 'record' && styles.hidden]} accessibilityElementsHidden={activeTab !== 'record'} importantForAccessibility={activeTab === 'record' ? 'auto' : 'no-hide-descendants'}>
          {diarySection}
        </View>
      </ScrollView>
      <Snackbar notice={notice} onDismiss={dismissSnackbar} />
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  backMark: { color: colors.text, fontSize: 28, lineHeight: 30 },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },

  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 60 },
  summary: { gap: 5 },
  phase: { color: palette.primary, fontSize: 14, fontWeight: '600' },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -1, lineHeight: 35 },
  when: { color: colors.muted, fontSize: 13 },
  tabs: { borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.lg },
  tab: { alignItems: 'center', borderBottomColor: 'transparent', borderBottomWidth: 2, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.sm },
  tabActive: { borderBottomColor: palette.primary },
  tabText: { color: colors.muted, fontSize: 15, fontWeight: '500' },
  tabTextActive: { color: palette.primaryDark, fontWeight: '600' },
  panel: { gap: spacing.lg },
  hidden: { display: 'none' },
  error: { color: colors.danger, fontSize: 12 },

  nextCard: { backgroundColor: colors.ink, borderRadius: radii.card, elevation: 4, gap: 6, justifyContent: 'flex-end', minHeight: 156, padding: 24, shadowColor: '#302927', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 20 },
  nextLabel: { color: palette.primarySoft, fontSize: 14, fontWeight: '600' },
  nextName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  nextProgress: { color: '#DFD8D3', fontSize: 12 },

  section: { backgroundColor: colors.surface, borderRadius: radii.card, elevation: 2, gap: spacing.sm, padding: spacing.lg, shadowColor: '#432F28', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 18 },
  sectionHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  action: { color: palette.primary, fontSize: 14, fontWeight: '600' },
  closePicker: { alignItems: 'flex-end' },
  // 위·아래 버튼을 세로로 붙여 하나의 조작 묶음으로 보이게 한다. 떨어뜨려 놓으면
  // 어느 항목의 버튼인지 헷갈린다.
  moves: { flexDirection: 'column' },
  // 세로로 두 개를 쌓아야 해서 44px을 다 주면 행이 너무 높아진다. 좌우를 넓혀 누를
  // 면적을 확보한다.
  moveButton: { alignItems: 'center', justifyContent: 'center', minWidth: 32, paddingVertical: 3 },
  moveMark: { color: colors.muted, fontSize: 14, lineHeight: 16 },
  // 맨 위·맨 아래에서는 누를 수 없다. 감추지 않고 흐리게만 두는 이유는, 사라지면
  // 행마다 버튼 수가 달라져 목록이 들쭉날쭉해 보이기 때문이다.
  moveMarkOff: { opacity: 0.3 },
  removeMark: { color: colors.muted, fontSize: 20, paddingHorizontal: 6 },
  empty: { color: colors.muted, fontSize: 12 },
  memo: { color: colors.text, fontSize: 13, lineHeight: 21 },

  placeList: { gap: spacing.sm, marginTop: 20 },
  // 위쪽 정렬이다. 메모가 붙어 가운데 칸이 길어져도 번호와 버튼이 이름 줄에 맞는다.
  place: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  placeOrder: { backgroundColor: palette.primarySoft, borderRadius: 13, color: palette.primary, fontSize: 14, fontWeight: '600', height: 26, lineHeight: 26, textAlign: 'center', width: 26 },
  placeOrderDone: { backgroundColor: colors.sage, color: '#FFFFFF' },
  placeBody: { flex: 1, gap: 2 },
  placeName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  placeNameDone: { color: colors.muted, textDecorationLine: 'line-through' },
  placeAddress: { color: colors.muted, fontSize: 11 },
  visitButton: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, minHeight: 36, justifyContent: 'center', paddingHorizontal: 12 },
  visitText: { color: palette.primary, fontSize: 14, fontWeight: '600' },

  completeButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: radii.lg, elevation: 2, justifyContent: 'center', minHeight: 54, shadowColor: palette.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 },
  completeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
