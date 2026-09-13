import { useInfiniteQuery } from '@tanstack/react-query';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { apiClient } from '@/shared/api/client';
import type { Schedule } from '@/shared/api/types';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

type Filters = { q: string; from: string; to: string };
type CollectionPage = { items: Schedule[]; next_cursor: string | null };
const EMPTY: Filters = { q: '', from: '', to: '' };
const dateLabel = (value: string) => new Date(value).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });

export default function CollectionScreen() {
  const { user, status } = useAuth();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const [kind, setKind] = useState<'schedules' | 'records'>('schedules');
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [dateTarget, setDateTarget] = useState<'from' | 'to' | null>(null);
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();
  const spaceId = user?.default_space_id;
  const query = useInfiniteQuery({
    queryKey: ['schedules', 'collection', spaceId, kind, filters],
    queryFn: async ({ pageParam, signal }) => (await apiClient.get<CollectionPage>(`/spaces/${spaceId}/schedules/collection`, {
      params: { kind, q: filters.q, from: filters.from || undefined, to: filters.to || undefined, cursor: pageParam }, signal,
    })).data,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.next_cursor ?? undefined,
    enabled: status === 'authenticated' && Boolean(spaceId),
  });
  const { refetch } = query;
  useFocusEffect(useCallback(() => {
    if (spaceId && status === 'authenticated') void refetch();
  }, [refetch, spaceId, status]));
  useEffect(() => {
    if (query.error) showSnackbar('모아보기를 불러오지 못했어요. 다시 시도해 주세요.');
  }, [query.error, showSnackbar]);
  if (status === 'anonymous') return <Redirect href="/(auth)/login" />;
  const apply = () => {
    if (draft.from && draft.to && draft.from > draft.to) {
      showSnackbar('종료일은 시작일과 같거나 이후로 선택해 주세요.');
      return;
    }
    setFilters({ ...draft, q: draft.q.trim() });
  };
  const items = query.data?.pages.flatMap(page => page.items) ?? [];
  const hasFilters = Boolean(filters.q || filters.from || filters.to);
  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/more')} style={styles.back}><Text style={styles.link}>‹ 전체 메뉴</Text></Pressable>
      <Text style={styles.title}>모아보기</Text>
    </View>
    <FlatList
      data={items} numColumns={2} keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.content} columnWrapperStyle={styles.gridRow}
      keyboardShouldPersistTaps="handled"
      refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { void refetch(); }}
      ListHeaderComponent={<View>
        <Text style={styles.hint}>계획한 하루와 남겨둔 기억을 찾아보세요.</Text>
        <View style={styles.tabs}>
          {(['schedules', 'records'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: kind === value }} onPress={() => setKind(value)} style={[styles.tab, kind === value && styles.activeTab]}><Text style={[styles.tabText, kind === value && styles.activeText]}>{value === 'schedules' ? '일정' : '기록'}</Text></Pressable>)}
        </View>
        <View style={styles.filters}>
          <TextInput accessibilityLabel="검색어" maxLength={100} placeholder={kind === 'records' ? '제목, 장소, 일기 내용 검색' : '제목, 장소 검색'} placeholderTextColor={colors.muted} value={draft.q} onChangeText={q => setDraft({ ...draft, q })} style={styles.input} returnKeyType="search" onSubmitEditing={apply} />
          <View style={styles.dateRow}>
            {(['from', 'to'] as const).map(target => <View style={styles.dateField} key={target}>
              <Text style={styles.hint}>{target === 'from' ? '시작일' : '종료일'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`${target === 'from' ? '시작일' : '종료일'} ${draft[target] || '선택'}`} style={styles.dateButton} onPress={() => setDateTarget(target)}><Text style={styles.text}>{draft[target] || '날짜 선택'}</Text></Pressable>
            </View>)}
          </View>
          <View style={styles.dateRow}>
            <Pressable accessibilityRole="button" style={styles.apply} onPress={apply}><Text style={styles.applyText}>검색 적용</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.reset} onPress={() => { setDraft(EMPTY); setFilters(EMPTY); }}><Text style={styles.text}>초기화</Text></Pressable>
          </View>
        </View>
        <Text style={styles.summary}>{filters.from || filters.to ? `${filters.from || '처음부터'} ~ ${filters.to || '전체'}` : '전체 기간'} · 날짜순</Text>
      </View>}
      ListEmptyComponent={<View style={styles.empty}>
        <Text style={styles.text}>{query.isPending ? '불러오고 있어요.' : query.isError ? '잠시 후 다시 불러와 주세요.' : hasFilters ? '조건에 맞는 항목이 없어요.' : kind === 'records' ? '아직 남겨둔 기록이 없어요.' : '아직 등록한 일정이 없어요.'}</Text>
        {!query.isPending && !query.isError && <Text style={styles.hint}>{hasFilters ? '검색어나 날짜 범위를 바꿔보세요.' : '하루를 만들고 기억을 하나씩 모아보세요.'}</Text>}
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${dateLabel(item.start_at)}, 장소 ${item.place_count}곳`} style={styles.card} onPress={() => router.push({ pathname: '/schedules/[id]', params: { id: item.id } })}>
        {item.record_summary.cover_thumbnail_url ? <Image source={{ uri: item.record_summary.cover_thumbnail_url }} style={styles.cover} /> : <View style={[styles.cover, styles.placeholder]}><Text style={styles.coverIcon}>{kind === 'records' ? '❏' : '▦'}</Text></View>}
        <View style={styles.cardBody}><Text style={styles.meta}>{dateLabel(item.start_at)}</Text><Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>장소 {item.place_count}곳{item.status === 'canceled' ? ' · 취소됨' : ''}</Text></View>
      </Pressable>}
      ListFooterComponent={query.isError ? <Pressable accessibilityRole="button" style={styles.load} onPress={() => query.isFetchNextPageError ? query.fetchNextPage() : refetch()}><Text style={styles.link}>다시 불러오기</Text></Pressable> : query.hasNextPage ? <Pressable accessibilityRole="button" style={styles.load} disabled={query.isFetchingNextPage} onPress={() => query.fetchNextPage()}><Text style={styles.link}>{query.isFetchingNextPage ? '불러오는 중…' : '더 보기'}</Text></Pressable> : null}
    />
    <Modal visible={Boolean(dateTarget)} transparent animationType="fade" onRequestClose={() => setDateTarget(null)}>
      <View style={styles.scrim}><View style={styles.dateModal} accessibilityViewIsModal>
        <Text style={styles.cardTitle}>{dateTarget === 'from' ? '시작일' : '종료일'} 선택</Text>
        <Calendar key={dateTarget} current={dateTarget ? draft[dateTarget] || undefined : undefined} monthFormat="yyyy년 M월" onDayPress={day => { if (dateTarget) setDraft({ ...draft, [dateTarget]: day.dateString }); setDateTarget(null); }} markedDates={dateTarget && draft[dateTarget] ? { [draft[dateTarget]]: { selected: true } } : {}} />
        <View style={styles.dateRow}><Pressable accessibilityRole="button" style={styles.reset} onPress={() => { if (dateTarget) setDraft({ ...draft, [dateTarget]: '' }); setDateTarget(null); }}><Text style={styles.text}>날짜 해제</Text></Pressable><Pressable accessibilityRole="button" style={styles.reset} onPress={() => setDateTarget(null)}><Text style={styles.link}>닫기</Text></Pressable></View>
      </View></View>
    </Modal>
    <Snackbar notice={notice} onDismiss={dismissSnackbar} />
  </SafeAreaView>;
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  back: { minHeight: 44, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  text: { color: colors.text, fontSize: 14 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  link: { color: palette.primary, fontSize: 14, fontWeight: '700' },
  tabs: { flexDirection: 'row', backgroundColor: palette.primarySoft, padding: 5, borderRadius: 14, marginTop: 24, marginBottom: 20 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 46, borderRadius: 10 },
  activeTab: { backgroundColor: colors.surface },
  tabText: { color: colors.muted, fontWeight: '700', fontSize: 15 },
  activeText: { color: palette.primary },
  filters: { backgroundColor: colors.surface, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, gap: 16 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, color: colors.text, fontSize: 14 },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1, gap: 8 },
  dateButton: { minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, justifyContent: 'center' },
  apply: { flex: 1, minHeight: 46, backgroundColor: palette.primary, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontWeight: '700' },
  reset: { minHeight: 46, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  summary: { color: colors.muted, fontSize: 13, marginTop: 24, marginBottom: 16 },
  gridRow: { gap: 12, marginBottom: 14 },
  card: { flex: 1, maxWidth: '48.5%', borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  cover: { width: '100%', aspectRatio: 4 / 3 },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  coverIcon: { fontSize: 34, color: palette.primary },
  cardBody: { padding: 12, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11, color: colors.muted },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  load: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dateModal: { padding: 20, backgroundColor: colors.surface, borderRadius: 20 },
});
