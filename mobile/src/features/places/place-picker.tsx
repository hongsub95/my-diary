import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { getApiError } from '@/shared/api/api-error';
import { LoadingIndicator } from '@/shared/components/loading-indicator';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import type { AddSchedulePlaceInput } from '@/features/schedules/schedule-api';
import { reverseAddress, searchMapPlaces, searchPlaces } from './place-api';
import { LocationMap, type Coordinate } from './location-map';

type Mode = 'name' | 'map';
const DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 };

/** The caller owns persistence; failed saves keep the selection open. */
export function PlacePicker({ onPick, onNotice, busy = false, initialCenter = DEFAULT_CENTER }: {
  onPick: (place: AddSchedulePlaceInput) => void | Promise<unknown>;
  onNotice: (message: string) => void;
  busy?: boolean;
  initialCenter?: Coordinate;
}) {
  const styles = useThemedStyles(createStyles);
  const [mode, setMode] = useState<Mode | null>(null);
  const [queries, setQueries] = useState({ name: '', map: '' });
  const [debounced, setDebounced] = useState('');
  const [nameCandidate, setNameCandidate] = useState<AddSchedulePlaceInput | null>(null);
  const [mapCandidate, setMapCandidate] = useState<AddSchedulePlaceInput | null>(null);
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [center, setCenter] = useState(initialCenter);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const lookupVersion = useRef(0);
  const query = mode ? queries[mode] : '';
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => () => { lookupVersion.current += 1; }, []);
  const search = useQuery({
    queryKey: ['place-picker', mode, debounced],
    queryFn: () => mode === 'map' ? searchMapPlaces(debounced) : searchPlaces(debounced),
    enabled: Boolean(mode && debounced && debounced === query.trim() && !(mode === 'name' && manual)),
    retry: false,
  });
  const items = debounced === query.trim() ? search.data?.items ?? [] : [];
  const blocked = busy || saving;
  useEffect(() => {
    if (mode && search.isError && query.trim() === debounced) {
      showSnackbar('검색을 불러오지 못했어요. 검색 다시 시도를 눌러 주세요.');
    }
  }, [mode, search.isError, search.errorUpdatedAt, query, debounced, showSnackbar]);
  function close() {
    if (lock.current || busy) return;
    lookupVersion.current += 1;
    setLookingUp(false);
    setMode(null);
    dismissSnackbar();
  }
  async function pickCoordinate(point: Coordinate) {
    const version = ++lookupVersion.current;
    setMapCandidate({ name: '', address: '', latitude: String(point.latitude), longitude: String(point.longitude), provider: 'manual', provider_place_id: null, address_detail: '' });
    setLookingUp(true);
    setLookupError('');
    try {
      const address = await reverseAddress(point.latitude, point.longitude);
      if (version !== lookupVersion.current) return;
      setMapCandidate(current => current ? { ...current, address: address ?? '' } : current);
      if (!address) {
        setLookupError('주소 확인 필요');
        showSnackbar('주소를 찾지 못했어요. 기본주소를 직접 입력해 주세요.');
      }
    } catch {
      if (version === lookupVersion.current) {
        setLookupError('주소 확인 필요');
        showSnackbar('주소를 불러오지 못했어요. 다시 시도하거나 직접 입력해 주세요.');
      }
    } finally {
      if (version === lookupVersion.current) setLookingUp(false);
    }
  }
  async function submit() {
    if (lock.current || blocked || !mode) return;
    const candidate = mode === 'map' ? mapCandidate : manual ? { name: manualName } : nameCandidate;
    if (!candidate) { showSnackbar('담을 장소를 선택해 주세요.'); return; }
    const name = candidate.name.trim() || (mode === 'map' ? candidate.address?.trim().slice(0, 200) : '');
    if (!name || (mode === 'map' && (!candidate.address?.trim() || candidate.latitude == null || candidate.longitude == null || lookingUp))) {
      showSnackbar(mode === 'map' ? '지도 위치와 기본주소를 확인해 주세요.' : '장소 이름을 입력해 주세요.');
      return;
    }
    lock.current = true;
    setSaving(true);
    dismissSnackbar();
    try {
      await onPick({ ...candidate, name, address: candidate.address?.trim() || null, address_detail: candidate.address_detail?.trim() || null });
      setQueries(current => ({ ...current, [mode]: '' }));
      if (mode === 'name') { setNameCandidate(null); setManualName(''); setManual(false); }
      else { setMapCandidate(null); setLookupError(''); }
      setMode(null);
      onNotice('장소를 담았어요');
    } catch (caught) {
      showSnackbar(getApiError(caught).message);
    } finally { lock.current = false; setSaving(false); }
  }
  const canSubmit = mode === 'map'
    ? Boolean(mapCandidate?.address?.trim() && mapCandidate.latitude != null && mapCandidate.longitude != null && !lookingUp)
    : manual ? Boolean(manualName.trim()) : Boolean(nameCandidate);

  return <View style={styles.container}>
    <View style={styles.choices}>
      {(['name', 'map'] as const).map(value => <Pressable key={value} accessibilityRole="button" disabled={blocked} onPress={() => { setMode(value); dismissSnackbar(); if (value === 'map' && !mapCandidate) setCenter(initialCenter); }} style={styles.choice}>
        <Text style={styles.choiceIcon}>{value === 'name' ? '⌕' : '⌖'}</Text>
        <Text style={styles.choiceTitle}>{value === 'name' ? '장소 이름' : '지도로 검색'}</Text>
        <Text style={styles.hint}>{value === 'name' ? '이름으로 찾아 선택해요' : '지도에서 위치와 주소를 정해요'}</Text>
      </Pressable>)}
    </View>
    <Modal visible={mode !== null} animationType="slide" onRequestClose={close} presentationStyle="fullScreen">
      <SafeAreaView style={styles.modal}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{mode === 'map' ? '지도로 장소 찾기' : '장소 이름으로 찾기'}</Text><Pressable accessibilityRole="button" accessibilityLabel="장소 선택 닫기" onPress={close} disabled={blocked} style={styles.close}><Text style={styles.label}>닫기</Text></Pressable></View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <TextInput accessibilityLabel={mode === 'map' ? '주소 또는 장소 검색' : '장소 이름 검색'} placeholder={mode === 'map' ? '주소 또는 장소 이름으로 검색' : '장소 이름으로 검색'} placeholderTextColor={colors.muted} style={styles.input} value={query} maxLength={100} editable={!blocked} onChangeText={value => {
              if (!mode) return;
              setQueries(current => ({ ...current, [mode]: value }));
              if (mode === 'name') { setNameCandidate(null); setManual(false); }
            }} />
            {mode === 'map' ? <><LocationMap center={center} point={mapCandidate?.latitude != null && mapCandidate.longitude != null ? { latitude: Number(mapCandidate.latitude), longitude: Number(mapCandidate.longitude) } : null} onPick={point => { if (!blocked) void pickCoordinate(point); }} /><Text style={styles.hint}>지도에서 약속할 지점을 눌러 주세요.</Text></> : null}
            {search.isFetching ? <LoadingIndicator message="장소를 찾고 있어요." textStyle={styles.hint} /> : null}
            {search.isError && query.trim() === debounced ? <Pressable accessibilityRole="button" onPress={() => void search.refetch()}><Text style={styles.link}>검색 다시 시도</Text></Pressable> : null}
            {search.data?.provider === 'mock' && query.trim() === debounced ? <Text style={styles.hint}>검색을 준비하고 있어요. 이름을 직접 입력해 주세요.</Text> : items.map((item, index) => <Pressable key={item.provider + '-' + (item.provider_place_id ?? item.address) + '-' + index} accessibilityRole="button" accessibilityState={{ selected: mode === 'name' ? nameCandidate === item : mapCandidate?.provider_place_id != null && mapCandidate.provider_place_id === item.provider_place_id }} disabled={blocked} style={[styles.result, nameCandidate === item && styles.selected]} onPress={() => {
              if (mode === 'name') { setNameCandidate(item); setManual(false); }
              else if (item.latitude != null && item.longitude != null) {
                lookupVersion.current += 1; setLookingUp(false); setLookupError('');
                setMapCandidate({ ...item, address_detail: '' });
                setCenter({ latitude: Number(item.latitude), longitude: Number(item.longitude) });
              }
            }}><Text style={styles.label}>{item.name}</Text>{item.address ? <Text style={styles.hint}>{item.address}</Text> : null}</Pressable>)}
            {query.trim() && search.isSuccess && !search.isFetching && debounced === query.trim() && !items.length ? <Text style={styles.hint}>검색 결과가 없어요. 지역명과 장소 이름을 함께 입력해 보세요.</Text> : null}
            {mode === 'name' ? <>
              <Pressable disabled={blocked} onPress={() => { setManual(!manual); setNameCandidate(null); }}><Text style={styles.link}>검색에 없나요? 이름만 직접 입력</Text></Pressable>
              {manual ? <TextInput accessibilityLabel="직접 입력할 장소 이름" placeholder="장소 이름" placeholderTextColor={colors.muted} value={manualName} maxLength={200} editable={!blocked} onChangeText={setManualName} style={styles.input} /> : null}
            </> : <>
              {lookingUp ? <LoadingIndicator message="선택한 위치의 주소를 확인하고 있어요…" textStyle={styles.hint} /> : null}
              {lookupError ? <Pressable accessibilityRole="button" disabled={blocked || lookingUp} onPress={() => { if (mapCandidate?.latitude != null && mapCandidate.longitude != null) void pickCoordinate({ latitude: Number(mapCandidate.latitude), longitude: Number(mapCandidate.longitude) }); }}><Text style={styles.link}>주소 다시 찾기</Text></Pressable> : null}
              {mapCandidate ? <View style={styles.fields}>
                <Text style={styles.label}>장소 이름</Text><TextInput accessibilityLabel="지도 장소 이름" value={mapCandidate.name} placeholder="비워두면 기본주소를 이름으로 사용해요" placeholderTextColor={colors.muted} maxLength={200} editable={!blocked} style={styles.input} onChangeText={name => setMapCandidate(current => current ? { ...current, name, provider: 'manual', provider_place_id: null } : current)} />
                <Text style={styles.label}>기본주소</Text><TextInput accessibilityLabel="기본주소" value={mapCandidate.address ?? ''} maxLength={500} editable={!blocked && !lookingUp} style={styles.input} onChangeText={address => setMapCandidate(current => current ? { ...current, address, provider: 'manual', provider_place_id: null } : current)} />
                <Text style={styles.hint}>주소를 직접 고쳤다면 지도 위치도 확인해 주세요.</Text>
                <Text style={styles.label}>상세주소 (선택)</Text><TextInput accessibilityLabel="상세주소 (선택)" value={mapCandidate.address_detail ?? ''} placeholder="2층, 201호, 정문 앞" placeholderTextColor={colors.muted} maxLength={200} editable={!blocked} style={styles.input} onChangeText={address_detail => setMapCandidate(current => current ? { ...current, address_detail } : current)} />
              </View> : null}
              <Pressable disabled={blocked} onPress={() => setMode('name')}><Text style={styles.link}>장소 이름으로 찾기</Text></Pressable>
            </>}
          </ScrollView>
          <View style={styles.footer}><Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked || !canSubmit, busy: saving }} disabled={blocked || !canSubmit} onPress={() => void submit()} style={[styles.submit, (blocked || !canSubmit) && styles.disabled]}>{saving ? <LoadingIndicator variant="ring" message="담는 중…" inline color="#fff" textStyle={styles.submitText} /> : <Text style={styles.submitText}>{mode === 'map' ? '이 위치 담기' : '이 장소 담기'}</Text>}</Pressable></View>
          <Snackbar notice={mode ? notice : null} onDismiss={dismissSnackbar} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </View>;
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: { gap: 12 }, flex: { flex: 1 },
  choices: { flexDirection: 'row', gap: 12 },
  choice: { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 16, gap: 8, minHeight: 140 },
  choiceIcon: { color: palette.primary, fontSize: 28 }, choiceTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  modal: { flex: 1, backgroundColor: colors.surface },
  header: { padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 18, fontWeight: '600' }, close: { padding: 12 },
  body: { padding: 20, gap: 14 }, fields: { gap: 10 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, fontSize: 14, minHeight: 48, paddingHorizontal: 14 },
  result: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 5 }, selected: { borderColor: palette.primary, borderWidth: 2 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' }, link: { color: palette.primary, paddingVertical: 12, fontSize: 14 },
  footer: { padding: 20 },
  submit: { alignItems: 'center', justifyContent: 'center', minHeight: 50, backgroundColor: palette.primary, borderRadius: 14 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 16 }, disabled: { opacity: 0.4 },
});
