import { useRouter } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDiaryFeed } from '@/features/diaries/diary-queries';
import type { RecordView } from '@/features/diaries/diary-adapter';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { EmptyState } from '@/shared/components/empty-state';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

/**
 * 기록 카드 하나.
 *
 * @param record 화면용 기록 모델
 * @param featured 목록 맨 위 큰 카드인지. 가장 최근 하루를 장면으로 먼저 보게 한다
 * @param onPress 눌렀을 때. 그 하루의 상세로 들어간다
 */
function RecordCard({
  record,
  featured,
  onPress,
}: {
  record: RecordView;
  featured: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  // 함께한 사람을 날짜 옆에 붙인다. 제품 정체성상 "언제, 누구와"가 제목보다 먼저다
  // (docs/UX_IDENTITY_REDIRECTION_SPEC.md 8절).
  const people = record.authorNames.length > 0 ? record.authorNames.join(' · ') : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        featured && styles.cardFeatured,
        pressed && styles.pressed,
      ]}>
      {record.coverUrl ? (
        <Image
          source={{ uri: record.coverUrl }}
          style={featured ? styles.featuredPhoto : styles.thumbnail}
        />
      ) : (
        // 사진 없이 글이나 타임라인만 남긴 하루도 기록이다. 자리를 비우지 않는다.
        <View style={[featured ? styles.featuredPhoto : styles.thumbnail, styles.emptyPhoto]}>
          <Text style={styles.emptyPhotoMark}>❏</Text>
        </View>
      )}

      <View style={featured ? styles.featuredCopy : styles.cardCopy}>
        <Text style={styles.date}>
          {record.dateLabel}
          {people ? ` · ${people}` : ''}
        </Text>
        <Text style={featured ? styles.featuredTitle : styles.cardTitle}>{record.title}</Text>
        {record.excerpt ? (
          <Text numberOfLines={featured ? 3 : 1} style={featured ? styles.quote : styles.cardNote}>
            {record.excerpt}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {record.placeCount > 0 ? <Text style={styles.meta}>⌖ {record.placeCount}곳</Text> : null}
          {record.photoCount > 0 ? <Text style={styles.meta}>▣ {record.photoCount}</Text> : null}
          {record.timelineCount > 0 ? <Text style={styles.meta}>⏱ {record.timelineCount}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * 기록 탭. 완료한 하루를 최신순으로 훑는 화면이다.
 *
 * 예정된 하루는 여기 오지 않는다. 계획은 일정 탭, 기억은 기록 탭으로 역할을 나눈다
 * (docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 2절).
 */
export default function RecordsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const feed = useDiaryFeed();

  if (feed.isLoading) return <LoadingScreen message="기록을 불러오고 있어요." />;
  if (feed.isError) {
    return <ErrorState message={getApiError(feed.error).message} onRetry={() => feed.refetch()} />;
  }

  // 커서로 이어 받은 페이지들을 한 줄로 편다. 화면은 페이지 경계를 알 필요가 없다.
  const records = feed.data?.pages.flatMap((page) => page.records) ?? [];

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <FlatList
        data={records}
        keyExtractor={(record) => String(record.scheduleId)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>MY DAYBOOK</Text>
            <Text style={styles.title}>우리가 보낸{'\n'}하루들</Text>
            <Text style={styles.description}>날짜보다 장면으로 먼저 기억해 보세요.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <RecordCard
            record={item}
            featured={index === 0}
            onPress={() =>
              router.push({ pathname: '/schedules/[id]', params: { id: item.scheduleId } })
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📖"
            title="아직 남긴 하루가 없어요"
            description="사진 한 장이나 한 문장으로 하루를 남겨 보세요."
            actionLabel="일정 보러 가기"
            onAction={() => router.push('/(tabs)/schedules')}
          />
        }
        // 끝에 다다르면 다음 페이지를 이어 받는다. 무한 스크롤이라 "더 보기" 버튼이 없다.
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          feed.isFetchingNextPage ? <Text style={styles.footer}>불러오는 중…</Text> : null
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  heading: { marginBottom: spacing.lg },
  eyebrow: { color: palette.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 27, fontWeight: '800', lineHeight: 34, marginTop: 6 },
  description: { color: colors.muted, fontSize: 12, marginTop: 7 },

  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, padding: 10 },
  cardFeatured: { flexDirection: 'column', gap: 0, overflow: 'hidden', padding: 0 },
  pressed: { opacity: 0.8 },

  thumbnail: { backgroundColor: colors.sand, borderRadius: 12, height: 88, width: 88 },
  featuredPhoto: { backgroundColor: colors.sand, height: 200, width: '100%' },
  emptyPhoto: { alignItems: 'center', justifyContent: 'center' },
  emptyPhotoMark: { color: colors.muted, fontSize: 22 },

  cardCopy: { flex: 1, justifyContent: 'center', gap: 3 },
  featuredCopy: { gap: 5, padding: spacing.lg },
  date: { color: colors.muted, fontSize: 10 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  featuredTitle: { color: colors.text, fontSize: 21, fontWeight: '800' },
  cardNote: { color: colors.muted, fontSize: 11 },
  quote: { color: colors.text, fontSize: 13, lineHeight: 21 },
  metaRow: { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  meta: { color: colors.muted, fontSize: 10 },

  footer: { color: colors.muted, fontSize: 12, paddingVertical: spacing.md, textAlign: 'center' },
});
