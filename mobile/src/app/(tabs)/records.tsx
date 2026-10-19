import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDiaryFeed } from '@/features/diaries/diary-queries';
import type { RecordView } from '@/features/diaries/diary-adapter';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { LoadingIndicator } from '@/shared/components/loading-indicator';
import { EmptyState } from '@/shared/components/empty-state';
import { getApiError } from '@/shared/api/api-error';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';

/** 가장 최근 기록은 큰 사진으로, 이어지는 기록은 앨범 속 작은 장면으로 보여 준다. */
function RecordCard({ record, featured, onPress }: {
  record: RecordView;
  featured: boolean;
  onPress: () => void;
}) {
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  // 글 작성자는 함께한 사람 전체와 다르므로 역할을 명시한다.
  const authors = record.authorNames.join(' · ');

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, featured && styles.cardFeatured, pressed && styles.pressed]}>
      {record.coverUrl ? (
        <Image source={{ uri: record.coverUrl }} style={featured ? styles.featuredPhoto : styles.thumbnail} accessibilityLabel={record.title + ' 대표 사진'} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[featured ? styles.featuredPhoto : styles.thumbnail, styles.emptyPhoto]}>
          <View style={styles.emptyPhotoIcon}>
            <SymbolView name={{ ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' }} size={featured ? 32 : 24} tintColor={palette.primaryDark} fallback={<Text style={styles.emptyPhotoMark}>▤</Text>} />
          </View>
          {featured && <><Text style={styles.emptyPhotoLabel}>{record.hasDiaryText ? '한 문장으로 남긴 하루' : '차곡차곡 남긴 하루'}</Text><Text style={styles.emptyPhotoDate}>{record.dateLabel}</Text></>}
        </View>
      )}
      <View style={featured ? styles.featuredCopy : styles.cardCopy}>
        {featured && <Text style={styles.featuredLabel}>최근 남긴 하루</Text>}
        <Text style={styles.date}>{record.dateLabel}</Text>
        <Text style={styles.cardTitle}>{record.title}</Text>
        {record.excerpt ? <Text numberOfLines={featured ? 3 : 2} style={featured ? styles.quote : styles.cardNote}>{record.excerpt}</Text> : null}
        {authors ? <Text style={styles.authors} numberOfLines={2}>글 · {authors}</Text> : null}
        <View style={styles.metaRow}>
          {record.placeCount > 0 && <View style={styles.metaItem}>
            <SymbolView name={{ ios: 'mappin', android: 'location_on', web: 'location_on' }} size={13} tintColor={colors.muted} fallback={<Text style={styles.meta}>⌖</Text>} />
            <Text style={styles.meta}>장소 {record.placeCount}곳</Text>
          </View>}
          {record.photoCount > 0 && <View style={styles.metaItem}>
            <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={13} tintColor={colors.muted} fallback={<Text style={styles.meta}>▧</Text>} />
            <Text style={styles.meta}>사진 {record.photoCount}장</Text>
          </View>}
          {record.timelineCount > 0 && <View style={styles.metaItem}>
            <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={13} tintColor={colors.muted} fallback={<Text style={styles.meta}>◷</Text>} />
            <Text style={styles.meta}>타임라인 {record.timelineCount}개</Text>
          </View>}
        </View>
      </View>
    </Pressable>
  );
}

/** 완료한 하루를 최신순으로 훑으며 기존 커서로 다음 기록을 이어 받는다. */
export default function RecordsScreen() {
  const router = useRouter();
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  const feed = useDiaryFeed();

  if (feed.isLoading) return <LoadingScreen message="기록을 불러오고 있어요." />;
  if (feed.isError) return <ErrorState message={getApiError(feed.error).message} onRetry={() => feed.refetch()} />;
  const records = feed.data?.pages.flatMap(page => page.records) ?? [];

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList
        data={records}
        keyExtractor={record => String(record.scheduleId)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.heading}>
            <View style={styles.headingIcon}>
              <SymbolView name={{ ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' }} size={22} tintColor={palette.primaryDark} fallback={<Text style={styles.emptyPhotoMark}>▤</Text>} />
            </View>
            <View style={styles.headingCopy}><Text accessibilityRole="header" style={styles.title}>기록</Text><Text style={styles.description}>사진과 한 문장으로 쌓인 하루.</Text></View>
          </View>
        }
        renderItem={({ item, index }) => <RecordCard record={item} featured={index === 0} onPress={() => router.push({ pathname: '/schedules/[id]', params: { id: item.scheduleId } })} />}
        ListEmptyComponent={
          <View style={styles.emptyCard}><EmptyState icon="📖" title="아직 남긴 하루가 없어요" description="사진 한 장이나 한 문장으로 하루를 남겨 보세요." actionLabel="일정 보러 가기" onAction={() => router.push('/(tabs)/schedules')} /></View>
        }
        onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage(); }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={feed.isFetchingNextPage ? <View style={styles.footer}><LoadingIndicator message="다음 기록을 불러오고 있어요." /></View> : null}
      />
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 132, paddingTop: spacing.xl },
  heading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  headingIcon: { alignItems: 'center', backgroundColor: palette.primarySoft, borderRadius: radii.lg, height: 48, justifyContent: 'center', width: 48 },
  headingCopy: { flex: 1 },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold },
  description: { color: colors.muted, fontSize: typography.body, lineHeight: 22, marginTop: spacing.xs },
  card: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.card, elevation: 2, flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg, padding: spacing.md, shadowColor: '#432F28', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.04, shadowRadius: 14 },
  cardFeatured: { alignItems: 'stretch', flexDirection: 'column', gap: 0, padding: spacing.sm },
  pressed: { opacity: 0.8 },
  thumbnail: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, height: 96, width: 88 },
  featuredPhoto: { aspectRatio: 4 / 3, backgroundColor: colors.surfaceMuted, borderRadius: radii.lg, width: '100%' },
  emptyPhoto: { alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  emptyPhotoIcon: { alignItems: 'center', backgroundColor: palette.primarySoft, borderRadius: radii.lg, minHeight: 48, justifyContent: 'center', minWidth: 48, padding: spacing.sm },
  emptyPhotoMark: { color: palette.primaryDark, fontSize: 22 },
  emptyPhotoLabel: { color: colors.text, fontSize: typography.body, fontWeight: typography.semibold, marginTop: spacing.md, textAlign: 'center' },
  emptyPhotoDate: { color: colors.muted, fontSize: 12, marginTop: spacing.xs, textAlign: 'center' },
  cardCopy: { flex: 1, gap: spacing.xs, minWidth: 0, paddingVertical: spacing.xs },
  featuredCopy: { gap: spacing.sm, padding: spacing.md },
  featuredLabel: { color: palette.primaryDark, fontSize: 12, fontWeight: typography.semibold },
  date: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  cardTitle: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold, lineHeight: 26 },
  cardNote: { color: colors.muted, fontSize: typography.body, lineHeight: 22 },
  quote: { color: colors.text, fontSize: typography.body, fontWeight: typography.regular, lineHeight: 23 },
  authors: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  metaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  metaItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radii.card, paddingVertical: spacing.md },
  footer: { alignItems: 'center', paddingVertical: spacing.md },
});
