import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { searchPlaces, type PlaceSearchResult } from './place-api';
import type { AddSchedulePlaceInput } from '@/features/schedules/schedule-api';
import { KakaoMap } from './kakao-map';

/**
 * 장소를 고르는 패널. 검색과 직접 입력을 함께 둔다.
 *
 * @param onPick 고른 장소를 넘긴다. 어디에 담을지는 쓰는 쪽이 정한다 —
 *   하루 만들기 2단계는 저장 전 목록에 쌓고, 일정 상세는 서버에 바로 담는다
 * @param busy 담는 중이면 중복 입력을 막는다
 *
 * 검색만 두지 않는 이유: 지도 공급자가 아직 mock이라 검색 결과로는 실제로 쓸 수 없고,
 * 공급자가 붙은 뒤에도 검색에 안 나오는 장소는 직접 넣어야 한다
 * (docs/DEVELOPMENT_BRIEF.md 6절).
 */
export function PlacePicker({
  onPick,
  busy = false,
}: {
  onPick: (place: AddSchedulePlaceInput) => void;
  busy?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  // 글자를 지웠을 때 이전 결과가 남지 않도록 빈 검색어에서는 아예 끈다.
  const search = useQuery({
    queryKey: ['places', 'search', searchQuery],
    queryFn: () => searchPlaces(searchQuery),
    enabled: searchQuery.length > 0 && searchQuery === query.trim(),
    retry: false,
  });

  /** 검색 결과를 담는다. 좌표와 출처를 그대로 넘겨 지도에 찍을 수 있게 한다. */
  function pickResult(result: PlaceSearchResult) {
    onPick({
      name: result.name,
      address: result.address,
      latitude: result.latitude,
      longitude: result.longitude,
      provider: result.provider,
      provider_place_id: result.provider_place_id,
    });
    setQuery('');
  }

  function pickManual() {
    const name = manualName.trim();
    if (!name) return;
    onPick({ name });
    setManualName('');
  }

  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel="장소 검색"
        onChangeText={(value) => { setQuery(value); setSelectedIndex(null); }}
        placeholder="장소 이름으로 검색"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={query}
      />

      {search.isFetching ? <Text style={styles.notice}>검색 중…</Text> : null}
      {search.isError && query.trim() === searchQuery ? <Text style={styles.notice}>검색을 불러오지 못했어요. 다시 검색하거나 아래에 직접 입력해 주세요.</Text> : null}

      {search.data && query.trim() && query.trim() === searchQuery ? (
        <View style={styles.results}>
          {search.data.provider === 'kakao' && search.data.items.length > 0 ? (
            <KakaoMap
              places={search.data.items.map((item, index) => ({ ...item, id: String(index) }))}
              selectedId={selectedIndex === null ? undefined : String(selectedIndex)}
              onSelect={(id) => setSelectedIndex(Number(id))}
            />
          ) : null}
          {search.data.items.length === 0 ? <Text style={styles.notice}>검색 결과가 없어요. 지역명과 장소 이름을 함께 입력해 보세요.</Text> : null}
          {/* 아직 지도 공급자가 붙기 전이라는 사실을 숨기지 않는다. 결과가 그럴듯해
              보여서 실제 장소로 오해하는 편이 더 위험하다. */}
          {search.data.provider === 'mock' ? (
            <Text style={styles.notice}>
              지도 공급자 연동 전이라 검색 결과는 예시입니다. 실제 장소는 아래에 직접 입력해 주세요.
            </Text>
          ) : null}
          {search.data.items.map((item, index) => (
            <Pressable
              key={`${item.provider}-${item.provider_place_id ?? item.name}`}
              onPress={() => setSelectedIndex(index)}
              disabled={busy}
              style={({ pressed }) => [styles.result, selectedIndex === index && { borderColor: palette.primary }, pressed && styles.pressed]}>
              <View style={styles.resultBody}>
                <Text style={styles.resultName}>{index + 1}. {item.name}</Text>
                {item.address ? <Text style={styles.resultAddress}>{item.address}</Text> : null}
              </View>
              <Text style={styles.plus}>{selectedIndex === index ? '✓' : '›'}</Text>
            </Pressable>
          ))}
          {selectedIndex !== null && search.data.items[selectedIndex] ? (
            <Pressable disabled={busy} onPress={() => pickResult(search.data.items[selectedIndex])} style={styles.addButton}>
              <Text style={styles.addText}>{search.data.items[selectedIndex].name} 담기</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.manualRow}>
        <TextInput
          accessibilityLabel="장소 이름"
          onChangeText={setManualName}
          onSubmitEditing={pickManual}
          placeholder="검색에 없으면 직접 입력"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          style={[styles.input, styles.flex]}
          value={manualName}
        />
        <Pressable
          onPress={pickManual}
          disabled={busy}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <Text style={styles.addText}>담기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: { gap: spacing.sm },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 14, minHeight: 48, paddingHorizontal: spacing.md },
  flex: { flex: 1 },
  notice: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  results: { gap: 6 },
  result: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: 10 },
  resultBody: { flex: 1, gap: 2 },
  resultName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  resultAddress: { color: colors.muted, fontSize: 11 },
  plus: { color: palette.primary, fontSize: 20, fontWeight: '700' },
  manualRow: { flexDirection: 'row', gap: spacing.sm },
  addButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 14, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.lg },
  addText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
