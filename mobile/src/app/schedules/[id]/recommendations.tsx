import { useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KakaoMap } from '@/features/places/kakao-map';
import { useSchedule } from '@/features/schedules/schedule-queries';
import { listSchedulePlaces, reorderSchedulePlaces } from '@/features/schedules/schedule-api';
import { ConditionForm } from '@/features/recommendations/condition-form';
import { addRecommendedCourse, formatCourseLeg, getRecommendationOptions, mergeShownKeys, previewCourse, recommendedIndexes, relaxConditions, rerollNotice, shownPlaceKeys, toBatchPlaces, warningLabels, type CourseRequest, type CourseResult } from '@/features/recommendations/recommendation-api';
import { CourseSaveError, createCourseSaver, type BatchPlace } from '@/features/recommendations/course-save';
import { formatDistance } from '@/shared/utils/distance';
import { getApiError } from '@/shared/api/api-error';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { ErrorState } from '@/shared/components/error-state';
import { colors, typography, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

export default function RecommendationScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; from?: string }>();
  const scheduleId = Number(params.id);
  const client = useQueryClient();
  const schedule = useSchedule(scheduleId);
  const options = useQuery({ queryKey: ['recommendation-options'], queryFn: getRecommendationOptions });
  const preview = useMutation({ mutationFn: (conditions: CourseRequest) => previewCourse(scheduleId, conditions) });
  const [result, setResult] = useState<CourseResult | null>(null);
  const [conditions, setConditions] = useState<CourseRequest | null>(null);
  // 지금까지 보여준 추천 장소의 place_key. "다시 추천" 때만 보내고, 조건을 바꿔 새로 찾으면
  // 비운다(API_SPEC 코스 추천 미리보기 '다시 추천'). conditions와 따로 두어, 완화 제안이나
  // 조건 수정으로 새로 찾을 때 예전 값이 섞여 들어가지 않게 한다.
  const [shownKeys, setShownKeys] = useState<string[]>([]);
  const [editing, setEditing] = useState(true);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<string | undefined>();
  const [checksByRank, setChecksByRank] = useState<Record<number, number[]>>({});
  const [placementPending, setPlacementPending] = useState(false);
  const saveCourse = useMemo(() => createCourseSaver({
    listPlaces: () => listSchedulePlaces(scheduleId),
    addPlaces: places => addRecommendedCourse(scheduleId, places),
    reorderPlaces: ids => reorderSchedulePlaces(scheduleId, ids),
    onPendingChange: setPlacementPending,
  }), [scheduleId]);
  const apply = useMutation({ mutationFn: ({ places, anchor }: { places: BatchPlace[]; anchor: CourseRequest['anchor'] }) => saveCourse(places, anchor) });
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();
  const locked = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const selected = result?.candidates.find(candidate => candidate.rank === selectedRank);
  const busy = preview.isPending || apply.isPending;
  const checkedIndexes = selectedRank == null ? [] : checksByRank[selectedRank] ?? [];
  const selectionLocked = busy || placementPending;
  const eligible = schedule.data?.status === 'planned' && ['upcoming', 'today'].includes(schedule.data.experience_phase);
  // 하루 만들기 2단계에서 왔으면 2단계로 돌아간다. 상세로 보내면 "하루 완성하기"를 못 누른
  // 채 흐름에서 빠져나온다. 웹의 recommendationReturnPath와 같은 규칙이다.
  const back = () =>
    params.from === 'plan'
      ? router.replace({ pathname: '/schedules/[id]/plan', params: { id: String(scheduleId) } })
      : router.replace({ pathname: '/schedules/[id]', params: { id: String(scheduleId) } });
  /** 코스를 찾는다. reroll이면 지금까지 본 장소를 빼 달라고 함께 보낸다. */
  async function request(next: CourseRequest, { reroll = false }: { reroll?: boolean } = {}) {
    if (locked.current || placementPending) return;
    locked.current = true;
    try {
      const data = await preview.mutateAsync(reroll ? { ...next, exclude_place_keys: shownKeys } : next);
      // 다시 추천이 새 코스를 못 찾으면 보던 코스를 그대로 둔다. 빈 화면으로 바꾸면 고르던
      // 코스를 잃고, 빈 화면 문구도 "조건에 맞는 곳이 없다"용이라 상황과 맞지 않는다.
      if (reroll && !data.candidates.length) {
        showSnackbar(rerollNotice(data, next, options.data?.categories ?? []) ?? '');
        return;
      }
      setShownKeys(current => reroll ? mergeShownKeys(current, shownPlaceKeys(data)) : shownPlaceKeys(data));
      setResult(data); setConditions(next); setSelectedRank(data.candidates[0]?.rank ?? null); setSelectedPlace(undefined); setEditing(false);
      setChecksByRank(Object.fromEntries(data.candidates.map(candidate => [candidate.rank, recommendedIndexes(candidate)])));
      scroll.current?.scrollTo({ y: 0, animated: false });
      const notice = reroll ? rerollNotice(data, next, options.data?.categories ?? []) : null;
      if (notice) showSnackbar(notice);
      else if (!data.candidates.length) showSnackbar('조건에 맞는 코스가 없어요. 반경이나 소분류를 바꿔 다시 찾아보세요.');
    } catch (caught) { showSnackbar(getApiError(caught).message); }
    finally { locked.current = false; }
  }
  async function save() {
    if (locked.current || !selected || !eligible || !checkedIndexes.length) return;
    locked.current = true;
    try {
      await apply.mutateAsync({ places: toBatchPlaces(selected, checkedIndexes), anchor: conditions?.anchor });
      await client.invalidateQueries({ queryKey: ['schedules'] });
      back();
    } catch (caught) {
      await client.invalidateQueries({ queryKey: ['schedules'] });
      showSnackbar(caught instanceof CourseSaveError ? caught.message : getApiError(caught).message);
    }
    finally { locked.current = false; }
  }
  if (schedule.isPending || options.isPending) return <LoadingScreen message="추천 화면을 준비하고 있어요." />;
  if (schedule.isError || options.isError || !schedule.data || !options.data) return <ErrorState message={getApiError(schedule.error ?? options.error).message} onRetry={() => { schedule.refetch(); options.refetch(); }} />;
  const count = selected ? toBatchPlaces(selected, checkedIndexes).length : 0;
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="일정으로 돌아가기" disabled={busy} onPress={back} style={styles.back}><Text style={styles.backText}>←</Text></Pressable><Text numberOfLines={1} style={styles.headerTitle}>{schedule.data.title}</Text></View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={styles.intro}><Text style={styles.eyebrow}>✧ 하루를 잇는 작은 제안</Text><Text style={styles.title}>{result ? '이런 하루는 어때요?' : '함께 갈 곳을 찾아볼까요?'}</Text><Text style={styles.muted}>마음에 드는 코스를 골라, 나만의 하루에 담아 보세요.</Text></View>
        {!eligible ? <View style={styles.card}><Text style={styles.subtitle}>계획 중인 하루에서 추천받을 수 있어요</Text><Pressable accessibilityRole="button" onPress={back} style={styles.button}><Text style={styles.action}>하루로 돌아가기</Text></Pressable></View> : <>
          {editing ? <ConditionForm key={JSON.stringify(conditions)} options={options.data} places={schedule.data.places} initial={conditions} busy={busy} onSubmit={request} onNotice={showSnackbar} /> : result && conditions ? <View style={[styles.card, styles.row]}><View style={styles.flex}><Text style={styles.subtitle}>{result.center.label} 주변</Text><Text style={styles.muted}>반경 {formatDistance(conditions.radius_m)} · {options.data.party_sizes.find(party => party.code === conditions.party_size)?.label} · {conditions.items.length}곳 추천</Text></View><Pressable accessibilityRole="button" disabled={selectionLocked} onPress={() => setEditing(true)} style={styles.softButton}><Text style={styles.action}>조건 바꾸기</Text></Pressable></View> : null}
          {!editing && result && conditions && !result.candidates.length ? <View style={styles.card}><Text style={styles.emptyIcon}>⌖</Text><Text style={styles.subtitle}>아직 어울리는 코스를 찾지 못했어요</Text><Text style={styles.muted}>{result.empty_item_indexes.map(index => `${index + 1}번째 ${options.data!.categories.find(category => category.code === conditions.items[index]?.category)?.label ?? '항목'}`).join(', ')}에 맞는 장소가 없어요.</Text>{result.relaxation_suggestions.map((suggestion, index) => <Pressable accessibilityRole="button" key={index} disabled={busy} onPress={() => request(relaxConditions(conditions, suggestion))} style={styles.softButton}><Text style={styles.action}>{suggestion.code === 'WIDEN_RADIUS' ? `반경 ${formatDistance(suggestion.radius_m!)}로 다시 찾기` : `${suggestion.item_index! + 1}번째 소분류를 상관없음으로 찾기`}</Text></Pressable>)}<Pressable accessibilityRole="button" disabled={selectionLocked} onPress={() => setEditing(true)} style={styles.button}><Text style={styles.action}>다른 조건으로 찾기</Text></Pressable></View> : null}
          {!editing && selected && result && conditions ? <>
            <View style={styles.sectionHead}><Text style={styles.subtitle}>추천 코스 <Text style={styles.action}>{result.candidates.length}</Text></Text><Pressable accessibilityRole="button" disabled={selectionLocked} onPress={() => request(conditions, { reroll: true })} style={styles.button}><Text style={styles.muted}>{preview.isPending ? '찾는 중…' : '↻ 다시 추천'}</Text></Pressable></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.candidates}>{result.candidates.map(candidate => <Pressable key={candidate.rank} accessibilityRole="button" accessibilityState={{ selected: candidate.rank === selectedRank }} disabled={selectionLocked} onPress={() => { setSelectedRank(candidate.rank); setSelectedPlace(undefined); }} style={[styles.candidate, candidate.rank === selectedRank && styles.candidateSelected]}><View style={styles.sectionHead}><Text style={styles.muted}>코스 {String(candidate.rank).padStart(2, '0')}</Text>{candidate.rank === selectedRank && <Text style={styles.action}>✓</Text>}</View><Text style={styles.distance}>직선거리 {formatDistance(candidate.total_distance_m)}</Text><Text style={styles.muted}>{candidate.places.map(place => place.name).join(' → ')}</Text><Text style={styles.tag}>{candidate.rank === 1 ? '가장 가까운 동선' : '다른 장소로 즐기는 하루'}</Text></Pressable>)}</ScrollView>
            <View style={styles.card}><Text style={styles.eyebrow}>한눈에 보는 코스</Text><Text style={styles.subtitle}>{result.center.label}에서 이어지는 하루</Text><KakaoMap key={selectedRank} places={selected.places.map((place, index) => ({ ...place, id: String(index) }))} selectedId={selectedPlace} onSelect={setSelectedPlace} /><Text style={styles.muted}>지도는 추천 코스 전체를 보여줘요. 담을 장소는 아래에서 선택해 주세요.</Text></View>
            <View style={styles.card}><View style={styles.sectionHead}><Text style={styles.subtitle}>담을 장소를 골라 주세요</Text><Text style={styles.muted}>{selected.places.length}곳</Text></View>{selected.places.map((place, index) => <View key={`${place.kind}-${place.provider_place_id ?? index}`}>
              {index > 0 && <Text style={styles.leg}>↓ {formatCourseLeg(selected.legs.find(leg => leg.to_index === index)?.distance_m)}</Text>}
              <View style={[styles.place, selectedPlace === String(index) && styles.placeSelected]}><Pressable accessibilityRole="button" accessibilityLabel={`${index + 1}번 ${place.name} 지도에서 보기`} onPress={() => setSelectedPlace(String(index))} style={styles.number}><Text style={styles.action}>{index + 1}</Text></Pressable><View style={styles.placeBody}><Text style={styles.eyebrow}>{place.kind === 'anchor' ? '기준 장소 · 이미 담은 곳' : options.data!.categories.find(category => category.code === place.category)?.label}</Text><Text style={styles.placeName}>{place.name}</Text>{place.kind === 'recommended' && <Pressable accessibilityRole="checkbox" accessibilityLabel={place.name + ' 일정에 담기'} accessibilityState={{ checked: checkedIndexes.includes(index), disabled: selectionLocked }} disabled={selectionLocked} onPress={() => setChecksByRank(current => ({ ...current, [selected.rank]: checkedIndexes.includes(index) ? checkedIndexes.filter(value => value !== index) : [...checkedIndexes, index] }))} style={styles.placeChoice}><Text style={styles.choiceMark}>{checkedIndexes.includes(index) ? '☑' : '☐'}</Text><Text style={styles.action}>일정에 담기</Text></Pressable>}{place.address && <Text style={styles.muted}>{place.address}</Text>}{place.reason && <Text style={styles.reason}>{place.reason}</Text>}{place.phone && <Text style={styles.muted}>{place.phone}</Text>}<View style={styles.checks}>{place.warnings.map(warning => <Pressable accessibilityRole="button" key={warning} onPress={() => showSnackbar(warning === 'PARTY_SIZE_UNVERIFIED' ? '방문 전 장소에 연락해 함께하는 인원의 이용 가능 여부를 확인해 주세요.' : '방문 전 장소의 영업시간을 확인해 주세요.')} style={styles.check}><Text style={styles.checkText}>{warningLabels[warning] ?? '이용 조건 확인 필요'}</Text></Pressable>)}</View></View></View>
            </View>)}</View>
            <View style={styles.note}><Text style={styles.noteTitle}>{placementPending ? '장소는 담았고 순서를 맞추는 단계가 남았어요' : '방문 전 확인해 주세요'}</Text>{placementPending && <Text style={styles.muted}>아래 버튼을 누르면 추가 저장 없이 기준 장소 앞 순서만 다시 맞춰요.</Text>}<Text style={styles.muted}>표시된 거리는 추천 코스 전체의 직선거리이며, 실제 길과 이동시간은 달라요. 영업시간과 예약 여부는 방문 전에 확인해 주세요.</Text>{conditions.anchor?.position === 'before' && <Text style={styles.muted}>선택한 장소를 코스 순서대로 기준 장소 바로 앞에 배치해요.</Text>}</View>
          </> : null}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
    {!editing && selected && eligible && <View style={styles.footer}><View style={styles.flex}><Text style={styles.footerTitle}>코스 {selected.rank} · {count}곳 선택</Text><Text style={styles.muted}>선택한 장소만 더해요.</Text></View><Pressable accessibilityRole="button" disabled={busy || !count} onPress={save} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{apply.isPending ? '저장하는 중…' : placementPending ? '순서 다시 맞추기' : '선택한 장소 담기'}</Text></Pressable></View>}
    <View pointerEvents="box-none" style={[styles.snackbarHost, { bottom: insets.bottom }]}><Snackbar notice={notice} onDismiss={dismissSnackbar} /></View>
  </SafeAreaView>;
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  snackbarHost: { position: 'absolute', left: 0, right: 0, zIndex: 100 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: colors.border },
  back: { minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: colors.text }, headerTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  body: { padding: 16, paddingBottom: 32, gap: 20 }, intro: { paddingVertical: 12, gap: 10 },
  title: { fontSize: 28, fontWeight: typography.semibold, letterSpacing: -1, color: colors.text },
  eyebrow: { fontSize: 12, fontWeight: '600', color: palette.primaryDark }, muted: { fontSize: 12, color: colors.muted, lineHeight: 20 },
  subtitle: { fontSize: typography.heading, color: colors.text, fontWeight: typography.semibold },
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  action: { color: palette.primaryDark, fontSize: 12, fontWeight: '600' },
  softButton: { backgroundColor: palette.primarySoft, borderRadius: 14, minHeight: 44, justifyContent: 'center', alignItems: 'center', padding: 12 },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  candidates: { gap: 12, padding: 2 }, candidate: { width: 238, gap: 12, borderRadius: 24, padding: 20, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.surface },
  candidateSelected: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  distance: { fontSize: typography.emphasis, fontWeight: typography.semibold, color: colors.text }, tag: { fontSize: 11, color: palette.primaryDark, backgroundColor: colors.surface, alignSelf: 'flex-start', padding: 6, borderRadius: 8 },
  leg: { color: colors.muted, fontSize: 11, paddingVertical: 12, paddingLeft: 22, borderLeftWidth: 1, borderColor: colors.border, marginLeft: 20 },
  place: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderRadius: 14 }, placeSelected: { backgroundColor: palette.primarySoft },
  number: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  placeChoice: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }, choiceMark: { fontSize: 24, color: palette.primaryDark },
  placeBody: { flex: 1, gap: 5 }, placeName: { color: colors.text, fontSize: typography.emphasis, fontWeight: typography.semibold }, reason: { fontSize: 12, color: colors.sage, lineHeight: 19, marginTop: 6 },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }, check: { minHeight: 44, backgroundColor: colors.surfaceMuted, padding: 8, borderRadius: 10, justifyContent: 'center' }, checkText: { fontSize: 11, color: colors.muted },
  note: { backgroundColor: colors.sand, borderRadius: 20, padding: 20, gap: 8 }, noteTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
  footer: { backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }, footerTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  primary: { minHeight: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.primary, borderRadius: 16, paddingHorizontal: 20 }, primaryText: { color: '#fff', fontSize: 14, fontWeight: '600' }, disabled: { opacity: 0.45 },
  emptyIcon: { color: palette.primaryDark, fontSize: 44, textAlign: 'center' },
});
