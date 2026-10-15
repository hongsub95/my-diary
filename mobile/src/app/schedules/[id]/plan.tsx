import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { KakaoMap } from '@/features/places/kakao-map';
import { PlacePicker } from '@/features/places/place-picker';
import { PlaceNoteEditor } from '@/features/schedules/place-note-editor';
import { formatRangeShort } from '@/features/schedules/schedule-dates';
import { useSchedule, useScheduleActions } from '@/features/schedules/schedule-queries';
import { StepIndicator } from '@/features/schedules/step-indicator';
import { getApiError } from '@/shared/api/api-error';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { colors, radii, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { seoulDateKey } from '@/shared/utils/date';
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
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();
  const [footerHeight, setFooterHeight] = useState(0);

  // 끝내면 일정 탭으로 나간다. dismissTo는 일정 탭이 나올 때까지 그 위 화면을 모두 걷어낸다.
  // 하루 만들기 단계와 그 사이에 열었던 화면(코스 추천)이 스택에 남지 않아, 이후 뒤로 가도
  // 만들기 단계로 되돌아오지 않는다. 예전처럼 상세로 replace하면 상세 아래에 만들기 단계가
  // 남을 수 있었다. 하루는 1단계에서 이미 저장돼 있어 "장소 없이 끝내기"도 같은 동작이다.
  const done = () =>
    router.dismissTo({ pathname: '/(tabs)/schedules', params: { notice: '하루를 만들었어요.' } });

  async function run(action: () => Promise<unknown>) {
    dismissSnackbar();
    try {
      await action();
    } catch (caught) {
      showSnackbar(getApiError(caught).message);
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
          <Pressable accessibilityLabel="1단계로 돌아가기" accessibilityRole="button" disabled={busy} onPress={() => router.replace({ pathname: '/schedules/new', params: { scheduleId: String(scheduleId) } })} style={styles.headerButton}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.headerTitle}>하루 만들기</Text>
          {/* 닫기(×)는 두지 않는다. 아래 고정된 "하루 완성하기"와 같은 동작이라 1단계처럼 단계 표시만 둔다. */}
          <StepIndicator current={2} total={2} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* 1단계의 "어떤 하루인가요?"와 짝을 이루는 질문. 하루 이름이 길어도 제목이 밀리지 않게
              이름과 기간은 아래 한 줄로 뺐다. */}
          <Text style={styles.title}>어디로 갈까요?</Text>
          {/* 이름과 기간을 한 줄에 이어 쓰지 않고 줄마다 하나씩 둔다. 박수(당일·1박 2일)는
              두지 않는다(2026-10-15 사용자 요청). 한 줄로 이으면 이름이 길 때 기간이 잘려 나갔다. */}
          <View style={styles.dayInfo}>
            <Text style={styles.dayName}>{day.title}</Text>
            <Text style={styles.subtitle}>{formatRangeShort(seoulDateKey(day.start_at), seoulDateKey(day.end_at))}</Text>
          </View>

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
              onNotice={showSnackbar}
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
          {/* 위의 장소 고르기 칸과 붙어 보이지 않게 간격을 둔다(2026-10-15 사용자 요청). */}
          {places.length ? (
            <View style={styles.mapSection}>
              <KakaoMap places={places.map((place) => ({ ...place, id: String(place.id) }))} />
            </View>
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

        </ScrollView>
        {/* 끝내기 버튼은 스크롤과 상관없이 아래에 고정한다. 장소를 여럿 담아도 내려 찾지 않게 한다. */}
        {/* 장소가 없을 때만 "장소 없이 끝내기"를 보인다. 담은 뒤에 이 문구가 남아 있으면
            담은 장소가 버려지는 것처럼 읽힌다. 둘 다 하는 일은 같다 — 일정 탭으로 간다. */}
        <View onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)} style={styles.footer}>
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
  header: { alignItems: 'center', backgroundColor: colors.background, flexDirection: 'row', minHeight: 58, paddingHorizontal: spacing.sm },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  back: { color: colors.text, fontSize: 35, lineHeight: 38 },
  headerTitle: { color: colors.text, flex: 1, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: 50 },
  title: { color: colors.text, fontSize: 24, fontWeight: '600', letterSpacing: -0.6, lineHeight: 32, marginTop: 12 },
  dayInfo: { gap: 2, marginTop: 8 },
  dayName: { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 22 },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  mapSection: { marginTop: 20 },
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
  footer: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 9, paddingBottom: 12, paddingHorizontal: spacing.lg, paddingTop: 12 },
  snackbarLayer: { left: 0, position: 'absolute', right: 0 },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 14, borderWidth: 1, justifyContent: 'center', minHeight: 54, paddingHorizontal: 20 },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  primaryButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: radii.lg, elevation: 2, justifyContent: 'center', minHeight: 54, paddingHorizontal: 18, shadowColor: palette.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  submit: { flex: 1 },
  disabled: { opacity: 0.5 },
});
