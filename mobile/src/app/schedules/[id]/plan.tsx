import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KakaoMap } from '@/features/places/kakao-map';
import { PlacePicker } from '@/features/places/place-picker';
import { PlaceNoteEditor } from '@/features/schedules/place-note-editor';
import { useSchedule, useScheduleActions } from '@/features/schedules/schedule-queries';
import { getApiError } from '@/shared/api/api-error';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { colors, radii, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { moveItem } from '@/shared/utils/reorder';

/**
 * 하루 만들기 2단계 — 갈 곳 정하기.
 *
 * 1단계에서 **이미 저장한 하루**에 장소를 담는다. 웹의 SchedulePlanPage와 같은 흐름이다.
 *
 * 예전에는 한 화면 안에서 1·2단계를 오가며 장소를 임시 목록에 쌓았다가, 마지막에 하루와
 * 장소를 한꺼번에 저장했다. 그 방식을 버린 이유(2026-10-05 결정):
 *
 * - 코스 추천은 저장된 하루가 있어야 부를 수 있다. 기준 장소가 그 하루에 있는지, 이미
 *   담은 곳인지를 서버가 확인하기 때문이다. 임시 목록 단계에서는 하루 id가 없었다.
 * - 마지막에 장소를 하나씩 따로 저장해서, 중간에 실패하면 일부만 담겼다.
 * - 웹과 앱의 하루 만들기 흐름이 달라 같은 기능을 두 번 다르게 만들어야 했다.
 *
 * 그래서 여기서는 담는 즉시 서버에 저장한다. 하루 상세의 장소 칸과 같은 방식이다.
 * 장소 없이 끝내도 하루는 이미 저장돼 있다 — 웹의 "장소 없이 끝내기"와 같다.
 */
export default function SchedulePlanScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const scheduleId = Number(rawId);

  const schedule = useSchedule(scheduleId);
  const { addPlace, removePlace, reorderPlaces, updatePlaceNote } = useScheduleActions(scheduleId);
  const [error, setError] = useState<string | null>(null);

  // 끝내면 상세로 간다. 뒤로 가기로 1단계에 돌아가지 않게 replace를 쓴다 — 하루는 이미
  // 저장됐으니 1단계로 돌아가 다시 저장하면 같은 하루가 둘이 된다.
  const done = () =>
    router.replace({ pathname: '/schedules/[id]', params: { id: String(scheduleId) } });

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(getApiError(caught).message);
    }
  }

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
  const places = day.places;
  const busy =
    addPlace.isPending || removePlace.isPending || reorderPlaces.isPending || updatePlaceNote.isPending;

  // 마지막으로 담은 장소 근처에서 다음 장소를 찾게 지도를 거기에 맞춘다.
  const lastPinned = [...places].reverse().find(
    (place) => place.latitude != null && place.longitude != null,
  );

  /**
   * 장소를 한 칸 옮긴다. 서버에는 바뀐 전체 순서를 보낸다(API_SPEC 6.4절).
   *
   * @param index 옮길 자리
   * @param step -1이면 위로, 1이면 아래로
   */
  const move = (index: number, step: number) => {
    const next = moveItem(places, index, step);
    if (next === places) return;
    run(() => reorderPlaces.mutateAsync(next.map((place) => place.id)));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          {/* 왼쪽 자리는 비워 둔다. 1단계로 돌아가는 뒤로 가기를 두지 않는 이유는 done 참고. */}
          <View style={styles.headerButton} />
          <Text style={styles.headerTitle}>하루 만들기</Text>
          <Pressable accessibilityLabel="닫기" accessibilityRole="button" onPress={done} style={styles.headerButton}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.progress}>
            <View style={styles.progressOn} />
            <View style={styles.progressOn} />
            <Text style={styles.progressText}>2 / 2</Text>
          </View>

          <Text style={styles.eyebrow}>STEP 2 · 갈 곳 정하기</Text>
          <Text style={styles.title}>{day.title}에{'\n'}어디를 담아볼까요?</Text>

          {/* 보조 동작이라 테두리만 둔다. "하루 완성하기"와 같은 무게로 두면 둘 중 무엇이
              다음 단계인지 헷갈린다. 추천 화면은 from=plan을 보고 여기로 돌아온다. */}
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/schedules/[id]/recommendations',
                params: { id: String(scheduleId), from: 'plan' },
              })
            }
            style={({ pressed }) => [styles.recommend, pressed && styles.pressed]}>
            <Text style={styles.recommendText}>어디로 갈지 고민이라면 · 코스 추천받기</Text>
          </Pressable>

          <View style={styles.placePickerSection}>
            {/* run()으로 감싸지 않는다. PlacePicker가 실패를 직접 보여주고, 성공했을 때만
                입력을 비운다. 여기서 오류를 삼키면 실패해도 담긴 것처럼 입력창이 비워진다. */}
            <PlacePicker
              onPick={(place) => addPlace.mutateAsync(place)}
              busy={busy}
              initialCenter={
                lastPinned
                  ? { latitude: Number(lastPinned.latitude), longitude: Number(lastPinned.longitude) }
                  : undefined
              }
            />
          </View>

          {/* 목록 위에 지도를 둔다. 마커 번호가 아래 순번과 같아서 "몇 번째로 어디를 가는지"를
              지도에서 바로 읽을 수 있다. 일정 상세와 같은 구성이다. */}
          {places.length ? (
            <KakaoMap places={places.map((place) => ({ ...place, id: String(place.id) }))} />
          ) : null}

          <View style={styles.placeList}>
            {places.length ? (
              places.map((place, index) => (
                <View key={place.id} style={styles.placeItem}>
                  <View style={styles.placeRow}>
                    <View style={styles.placeNumber}>
                      <Text style={styles.placeNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.placeCopy}>
                      <Text style={styles.placeName}>{place.name}</Text>
                      {place.address ? <Text style={styles.placeMeta}>{place.address}</Text> : null}
                    </View>
                    <View style={styles.moves}>
                      <Pressable
                        accessibilityLabel={`${place.name} 순서 올리기`}
                        disabled={busy || index === 0}
                        onPress={() => move(index, -1)}
                        style={styles.moveButton}>
                        <Text style={[styles.moveMark, index === 0 && styles.moveMarkOff]}>↑</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`${place.name} 순서 내리기`}
                        disabled={busy || index === places.length - 1}
                        onPress={() => move(index, 1)}
                        style={styles.moveButton}>
                        <Text style={[styles.moveMark, index === places.length - 1 && styles.moveMarkOff]}>↓</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      accessibilityLabel={`${place.name} 빼기`}
                      disabled={busy}
                      onPress={() => run(() => removePlace.mutateAsync(place.id))}>
                      <Text style={styles.remove}>×</Text>
                    </Pressable>
                  </View>
                  <View style={styles.placeNote}>
                    <PlaceNoteEditor
                      placeName={place.name}
                      plannedTime={place.plannedTime}
                      memo={place.memo}
                      editable
                      busy={busy}
                      onSave={(note) => updatePlaceNote.mutateAsync({ schedulePlaceId: place.id, ...note })}
                    />
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyPlaces}>
                <Text style={styles.emptyPlacesIcon}>⌖</Text>
                <Text style={styles.emptyPlacesTitle}>아직 담은 장소가 없어요</Text>
                <Text style={styles.emptyPlacesText}>장소 없이 하루만 먼저 만들어도 괜찮아요.</Text>
              </View>
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* 장소가 없을 때만 "장소 없이 끝내기"를 보인다. 담은 뒤에 이 문구가 남아 있으면
              담은 장소가 버려지는 것처럼 읽힌다. 둘 다 하는 일은 같다 — 상세로 간다. */}
          <View style={styles.actions}>
            {places.length === 0 ? (
              <Pressable accessibilityRole="button" onPress={done} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>장소 없이 끝내기</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={done}
              style={[styles.primaryButton, styles.submit, busy && styles.disabled]}>
              <Text style={styles.primaryText}>하루 완성하기</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.background, flexDirection: 'row', minHeight: 58, paddingHorizontal: spacing.sm },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  close: { color: colors.muted, fontSize: 25 },
  headerTitle: { color: colors.text, flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: 50 },
  progress: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  progressOn: { backgroundColor: palette.primary, borderRadius: 4, flex: 1, height: 4 },
  progressText: { color: colors.muted, fontSize: 14, fontWeight: '600', marginLeft: 5 },
  eyebrow: { color: palette.primaryDark, fontSize: 14, fontWeight: '600', letterSpacing: 1.1, marginTop: 28 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -1, lineHeight: 35, marginTop: 9 },
  recommend: { alignItems: 'center', borderColor: palette.primary, borderRadius: radii.lg, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', marginTop: 20, minHeight: 48, paddingHorizontal: 14 },
  recommendText: { color: palette.primaryDark, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  placePickerSection: { marginTop: 16 },
  error: { color: colors.danger, fontSize: 12, marginTop: 14 },
  placeList: { backgroundColor: colors.surface, borderRadius: radii.card, elevation: 2, marginTop: 14, overflow: 'hidden', padding: 12, shadowColor: '#432F28', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 18 },
  placeItem: { paddingBottom: 6 },
  placeRow: { alignItems: 'center', flexDirection: 'row', minHeight: 67, paddingHorizontal: 4 },
  // 번호(30) + 여백(12)만큼 들여써 메모가 장소 이름 줄에서 시작하게 한다.
  placeNote: { paddingLeft: 46, paddingRight: 4 },
  placeNumber: { alignItems: 'center', backgroundColor: palette.primarySoft, borderColor: palette.primary, borderRadius: 15, borderWidth: 1, height: 30, justifyContent: 'center', width: 30 },
  placeNumberText: { color: palette.primaryDark, fontSize: 14, fontWeight: '600' },
  placeCopy: { flex: 1, marginLeft: 12 },
  placeName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  placeMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  // 위·아래 버튼을 세로로 붙여 하나의 조작 묶음으로 보이게 한다.
  moves: { flexDirection: 'column' },
  moveButton: { alignItems: 'center', justifyContent: 'center', minWidth: 30, paddingVertical: 3 },
  moveMark: { color: colors.muted, fontSize: 14, lineHeight: 16 },
  // 끝에서는 감추지 않고 흐리게만 둔다. 사라지면 행마다 버튼 수가 달라 보인다.
  moveMarkOff: { opacity: 0.3 },
  remove: { color: colors.muted, fontSize: 22, padding: 8 },
  emptyPlaces: { alignItems: 'center', paddingHorizontal: 15, paddingVertical: 28 },
  emptyPlacesIcon: { color: palette.primary, fontSize: 31 },
  emptyPlacesTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 8 },
  emptyPlacesText: { color: colors.muted, fontSize: 12, marginTop: 5 },
  actions: { flexDirection: 'row', gap: 9 },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 14, borderWidth: 1, justifyContent: 'center', marginTop: 22, minHeight: 52, paddingHorizontal: 20 },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  primaryButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: radii.lg, elevation: 2, justifyContent: 'center', marginTop: 22, minHeight: 54, paddingHorizontal: 18, shadowColor: palette.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  submit: { flex: 1 },
  disabled: { opacity: 0.5 },
});
