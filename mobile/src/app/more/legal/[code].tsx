import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchLegalDocument, type LegalBlock } from '@/features/legal/legal-api';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

/**
 * 약관·개인정보 처리방침 화면.
 *
 * 문서 하나마다 화면을 만들지 않고 주소의 코드로 갈라 쓴다. 두 문서의 구조가 같고,
 * 나중에 문서가 늘어도(예: 위치기반서비스 약관) 코드만 추가하면 된다.
 *
 * 본문은 서버가 블록 목록으로 내려준다(app/legal/service.py). 그래서 여기서는
 * 마크다운을 해석하지 않고 종류별로 그리기만 한다.
 */
export default function LegalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const styles = useThemedStyles(createStyles);

  const document = useQuery({
    queryKey: ['legal', code],
    queryFn: () => fetchLegalDocument(code!),
    enabled: Boolean(code),
    // 약관은 자주 바뀌지 않는다. 화면을 드나들 때마다 다시 받을 이유가 없다.
    staleTime: 1000 * 60 * 60,
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>{document.data?.title ?? '약관'}</Text>
        {/* 좌우 폭을 맞춰 제목이 가운데에 오게 한다. */}
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {document.isPending ? <Text style={styles.hint}>문서를 불러오는 중…</Text> : null}

        {document.isError ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{getApiError(document.error).message}</Text>
            <Pressable onPress={() => document.refetch()} style={styles.retry}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {document.data ? (
          <View style={styles.card}>
            {/* 언제 고친 문서인지 먼저 보여준다. 약관은 "지금 보는 게 최신인가"가
                가장 먼저 궁금한 정보다. */}
            <Text style={styles.updated}>최종 개정일 {document.data.updated_at}</Text>
            {document.data.blocks.map((block, index) => (
              <Block key={index} block={block} styles={styles} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * 블록 하나를 그린다.
 *
 * 모르는 종류는 아무것도 그리지 않는다. 서버가 블록 종류를 늘렸는데 앱이 아직 모를 때,
 * 깨진 화면 대신 그 부분만 빠지게 하려는 것이다. 앱은 배포가 느려서 이런 어긋남이
 * 웹보다 오래 간다.
 */
function Block({ block, styles }: { block: LegalBlock; styles: Styles }) {
  if (block.type === 'heading') {
    return <Text style={block.level && block.level >= 3 ? styles.subHeading : styles.heading}>{block.text}</Text>;
  }
  if (block.type === 'paragraph') return <Text style={styles.paragraph}>{block.text}</Text>;
  if (block.type === 'bullet') return <Text style={styles.bullet}>· {block.text}</Text>;
  if (block.type === 'callout') return <Text style={styles.callout}>{block.text}</Text>;

  if (block.type === 'table' && block.rows) {
    const [header, ...rows] = block.rows;
    // 좁은 화면에서 표를 칸으로 그리면 글자가 세로로 쪼개져 읽을 수 없다.
    // 머리글을 각 값 앞에 붙여 "항목: 값" 형태로 편다.
    return (
      <View style={styles.table}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.tableRow}>
            {row.map((cell, index) => (
              <Text key={index} style={styles.tableCell}>
                <Text style={styles.tableLabel}>{header[index] ?? ''}</Text>
                {'  '}
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return null;
}

type Styles = ReturnType<typeof createStyles>;

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: spacing.sm },
  // 터치 영역을 44px 이상으로 유지한다 (docs/BOTTOM_NAVIGATION_SPEC.md 7절).
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  back: { color: colors.text, fontSize: 28, lineHeight: 30 },
  headerTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  updated: { borderBottomColor: colors.border, borderBottomWidth: 1, color: colors.muted, fontSize: 12, paddingBottom: spacing.sm },
  heading: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: spacing.sm },
  subHeading: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: spacing.xs },
  paragraph: { color: colors.text, fontSize: 14, lineHeight: 23 },
  bullet: { color: colors.text, fontSize: 14, lineHeight: 23, paddingLeft: spacing.xs },
  // 꼭 읽어야 하는 주의사항. 본문과 같은 모양이면 그냥 지나친다.
  callout: { backgroundColor: colors.background, borderLeftColor: palette.primary, borderLeftWidth: 3, borderRadius: 8, color: colors.text, fontSize: 13, lineHeight: 21, padding: spacing.md },
  table: { gap: spacing.sm },
  tableRow: { backgroundColor: colors.background, borderRadius: 10, gap: 2, padding: spacing.md },
  tableCell: { color: colors.text, fontSize: 13, lineHeight: 20 },
  tableLabel: { color: colors.muted, fontWeight: '700' },
  errorBox: { alignItems: 'flex-start', gap: spacing.sm },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  retry: { backgroundColor: palette.primarySoft, borderRadius: 999, justifyContent: 'center', minHeight: 40, paddingHorizontal: spacing.md },
  retryText: { color: palette.primaryDark, fontSize: 13, fontWeight: '700' },
});
