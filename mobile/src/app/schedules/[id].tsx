import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiarySection } from '@/features/diaries/diary-section';
import { PlacePicker } from '@/features/places/place-picker';
import { KakaoMap } from '@/features/places/kakao-map';
import { useSchedule, useScheduleActions } from '@/features/schedules/schedule-queries';
import type { SchedulePlaceView } from '@/features/schedules/schedule-adapter';
import { getApiError } from '@/shared/api/api-error';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { formatKoreanDateTime } from '@/shared/utils/date';

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
  onToggle,
  onRemove,
  busy,
}: {
  places: SchedulePlaceView[];
  checkable: boolean;
  removable: boolean;
  onToggle: (place: SchedulePlaceView) => void;
  onRemove: (place: SchedulePlaceView) => void;
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
          </View>
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
 * 하루 상세. 같은 화면이지만 시간 상태에 따라 무엇을 앞에 두는지가 달라진다.
 *
 * - 예정: 장소 흐름이 먼저다. 어디를 어떤 순서로 갈지 정하는 화면이다
 * - 당일: 다음 장소와 진행 상태가 먼저다. 지금 뭘 하면 되는지만 보면 된다
 * - 완료: 사진과 일기가 먼저다. 시간표가 아니라 그날의 기억을 보러 오는 화면이다
 *
 * 기준은 docs/UX_IDENTITY_REDIRECTION_SPEC.md 7절과
 * docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 3.3~3.5절이며, 웹과 같은 규칙이다.
 */
export default function ScheduleDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const scheduleId = Number(rawId);

  const schedule = useSchedule(scheduleId);
  const { complete, toggleVisited, addPlace, removePlace } = useScheduleActions(scheduleId);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  if (schedule.isLoading) return <LoadingScreen message="하루를 불러오고 있어요." />;
  if (schedule.isError || !schedule.data) {
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
  // 다녀왔거나 완료한 하루. 기록이 앞에 오고 계획 정보는 뒤로 물러난다.
  const isDone = phase === 'recorded' || phase === 'record_pending';
  const visited = day.places.filter((place) => place.visited).length;
  const nextPlace = day.places.find((place) => !place.visited) ?? null;

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(getApiError(caught).message);
    }
  }

  const placesSection = (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        {/* 완료한 하루에는 계획을 더 담지 않는다. 그날 있었던 일은 방문 기록으로 남긴다. */}
        <Text style={styles.sectionTitle}>{isDone ? '다녀온 장소' : '장소'}</Text>
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
            onPick={(place) => run(() => addPlace.mutateAsync(place))}
          />
          <Pressable onPress={() => setPicking(false)} style={styles.closePicker}>
            <Text style={styles.action}>닫기</Text>
          </Pressable>
        </>
      ) : null}

      {day.places.length > 0 ? (
        <KakaoMap places={day.places.map(place => ({ ...place, id: String(place.id) }))} />
      ) : null}

      {day.places.length > 0 ? (
        <PlaceList
          places={day.places}
          checkable={isToday}
          // 방문 체크가 켜진 당일에는 빼기 버튼을 두지 않는다. 두 버튼이 같은 자리에
          // 겹치면 다녀온 곳을 지우려다 잘못 누르기 쉽다.
          removable={!isDone && !isToday}
          busy={toggleVisited.isPending || removePlace.isPending}
          onToggle={(place) =>
            run(() =>
              toggleVisited.mutateAsync({ schedulePlaceId: place.id, visited: !place.visited }),
            )
          }
          onRemove={(place) => run(() => removePlace.mutateAsync(place.id))}
        />
      ) : !picking ? (
        <Text style={styles.empty}>
          {isDone ? '담아둔 장소가 없었어요.' : '아직 담은 장소가 없어요.'}
        </Text>
      ) : null}
    </View>
  );

  const diarySection = (
    <DiarySection scheduleId={scheduleId} dateKey={day.dateKey} places={day.places} />
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
        <Text style={styles.headerTitle}>하루</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.phase}>
            {PHASE_LABELS[phase] ?? phase} · {day.space_name}
          </Text>
          <Text style={styles.title}>{day.title}</Text>
          <Text style={styles.when}>{formatKoreanDateTime(day.start_at)}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* 당일에는 다음 장소와 진행률을 맨 위에 둔다. 지금 뭘 하면 되는지가 먼저다. */}
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

        {/* 완료한 하루는 사진과 일기가 먼저, 계획 정보가 나중이다. */}
        {isDone ? (
          <>
            {diarySection}
            {placesSection}
          </>
        ) : (
          <>
            {placesSection}
            {diarySection}
          </>
        )}

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
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  backMark: { color: colors.text, fontSize: 28, lineHeight: 30 },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },

  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 60 },
  summary: { gap: 5 },
  phase: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  when: { color: colors.muted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 12 },

  nextCard: { backgroundColor: colors.text, borderRadius: 18, gap: 4, padding: spacing.lg },
  nextLabel: { color: palette.primarySoft, fontSize: 12, fontWeight: '700' },
  nextName: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  nextProgress: { color: '#DFD8D3', fontSize: 12 },

  section: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  sectionHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  action: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  closePicker: { alignItems: 'flex-end' },
  removeMark: { color: colors.muted, fontSize: 20, paddingHorizontal: 6 },
  empty: { color: colors.muted, fontSize: 12 },
  memo: { color: colors.text, fontSize: 13, lineHeight: 21 },

  placeList: { gap: spacing.sm },
  place: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  placeOrder: { backgroundColor: palette.primarySoft, borderRadius: 13, color: palette.primary, fontSize: 11, fontWeight: '800', height: 26, lineHeight: 26, textAlign: 'center', width: 26 },
  placeOrderDone: { backgroundColor: colors.sage, color: '#FFFFFF' },
  placeBody: { flex: 1, gap: 2 },
  placeName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  placeNameDone: { color: colors.muted, textDecorationLine: 'line-through' },
  placeAddress: { color: colors.muted, fontSize: 11 },
  visitButton: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, minHeight: 36, justifyContent: 'center', paddingHorizontal: 12 },
  visitText: { color: palette.primary, fontSize: 12, fontWeight: '700' },

  completeButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 14, justifyContent: 'center', minHeight: 52 },
  completeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
