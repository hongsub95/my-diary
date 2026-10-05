import { formatDistance } from '@/shared/utils/distance';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SchedulePlaceView } from '@/features/schedules/schedule-adapter';
import { colors, typography, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { ChoiceField } from './choice-field';
import { type CourseRequest, type RecommendationOptions } from './recommendation-api';

export function ConditionForm({ options, places, initial, busy, onSubmit, onNotice }: {
  options: RecommendationOptions; places: SchedulePlaceView[]; initial: CourseRequest | null;
  busy: boolean; onSubmit: (conditions: CourseRequest) => void; onNotice: (message: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const [area, setArea] = useState(initial?.area_query ?? '');
  const [anchor, setAnchor] = useState(initial?.anchor ? String(initial.anchor.schedule_place_id) : '');
  const [position, setPosition] = useState<'before' | 'after'>(initial?.anchor?.position ?? 'after');
  const [radius, setRadius] = useState(initial?.radius_m ?? options.default_radius_m);
  const [party, setParty] = useState(initial?.party_size ?? '2');
  const [items, setItems] = useState(initial?.items ?? Array.from({ length: options.default_item_count }, (_, index) => ({ category: options.categories[index % options.categories.length].code, subcategory: 'any' })));
  const input = useRef<TextInput>(null);
  function submit() {
    if (!anchor && !area.trim()) { input.current?.focus(); onNotice('추천받을 지역을 입력하거나 기준 장소를 선택해 주세요.'); return; }
    onSubmit({ ...(anchor ? { anchor: { schedule_place_id: Number(anchor), position } } : { area_query: area.trim() }), radius_m: radius, party_size: party, items });
  }
  return <View style={styles.card}>
    <Text style={styles.title}>어떤 하루를 보내고 싶나요?</Text><Text style={styles.hint}>지역이나 담아 둔 장소 주변에서 갈 곳을 찾아요.</Text>
    <ChoiceField label="기준 장소" value={anchor} choices={[{ code: '', label: '지역으로 찾기' }, ...places.filter(place => place.latitude != null && place.longitude != null).map(place => ({ code: String(place.id), label: place.name }))]} disabled={busy} onChange={setAnchor} />
    {anchor ? <ChoiceField label="방문 순서" value={position} choices={[{ code: 'after', label: '기준 장소 이후' }, { code: 'before', label: '기준 장소 이전' }]} disabled={busy} onChange={value => setPosition(value as 'before' | 'after')} /> : <View style={styles.field}><Text style={styles.hint}>지역</Text><TextInput ref={input} accessibilityLabel="추천받을 지역" placeholder="예: 성수, 연남동, 강남역" placeholderTextColor={colors.muted} value={area} onChangeText={setArea} maxLength={100} editable={!busy} style={styles.input} /></View>}
    <View style={styles.row}><ChoiceField label="검색 반경" value={String(radius)} choices={options.radius_options_m.map(value => ({ code: String(value), label: formatDistance(value) }))} disabled={busy} onChange={value => setRadius(Number(value))} /><ChoiceField label="함께하는 인원" value={party} choices={options.party_sizes} disabled={busy} onChange={setParty} /></View>
    <Text style={styles.subtitle}>방문하고 싶은 순서 · {items.length} / {options.max_item_count}</Text>
    {items.map((item, index) => <View style={styles.item} key={index}><View style={styles.itemHead}><Text style={styles.number}>{index + 1}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${index + 1}번째 항목 삭제`} disabled={busy || items.length === 1} onPress={() => setItems(items.filter((_, i) => i !== index))} style={styles.remove}><Text style={styles.hint}>삭제</Text></Pressable></View><View style={styles.row}>
      <ChoiceField label="대분류" value={item.category} choices={options.categories} disabled={busy} onChange={category => setItems(items.map((old, i) => i === index ? { category, subcategory: 'any' } : old))} />
      <ChoiceField label="소분류" value={item.subcategory} choices={options.categories.find(category => category.code === item.category)?.subcategories ?? []} disabled={busy} onChange={subcategory => setItems(items.map((old, i) => i === index ? { ...old, subcategory } : old))} />
    </View></View>)}
    <Pressable accessibilityRole="button" disabled={busy || items.length >= options.max_item_count} onPress={() => setItems([...items, { category: options.categories[0].code, subcategory: 'any' }])} style={styles.add}><Text style={styles.action}>+ 코스 항목 추가</Text></Pressable>
    <Text style={styles.hint}>거리 반경은 직선 기준이에요. 방문 순서는 선택한 순서 그대로 유지돼요.</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? '어울리는 장소를 찾는 중…' : '코스 추천받기'}</Text></Pressable>
  </View>;
}
const createStyles = (palette: ThemePalette) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, gap: 16 },
  title: { fontSize: typography.heading, fontWeight: typography.semibold, color: colors.text },
  hint: { fontSize: 12, lineHeight: 19, color: colors.muted },
  subtitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  field: { gap: 8 },
  input: { minHeight: 48, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, color: colors.text },
  row: { flexDirection: 'row', gap: 10 },
  item: { gap: 8, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { color: palette.primaryDark, fontWeight: '600', fontSize: 16 },
  remove: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  add: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 14 },
  action: { color: palette.primaryDark, fontWeight: '600' },
  primary: { minHeight: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.primary, borderRadius: 16 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
