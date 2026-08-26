import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { ScheduleCard } from '@/features/schedules/schedule-card';
import { listMockSchedules } from '@/features/schedules/schedule-repository';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { colors, spacing } from '@/shared/theme';
import { seoulDateKey } from '@/shared/utils/date';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const schedules = useQuery({ queryKey: ['mock-schedules'], queryFn: listMockSchedules });

  const summary = useMemo(() => {
    const items = schedules.data ?? [];
    const now = new Date();
    const todayKey = seoulDateKey(now.toISOString());
    const today = items
      .filter((schedule) => seoulDateKey(schedule.start_at) === todayKey)
      .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at));
    const next = items
      .filter((schedule) => schedule.status === 'planned' && Date.parse(schedule.start_at) > now.getTime())
      .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at))[0];
    const needsRecord = items
      .filter((schedule) => schedule.status === 'completed' && !schedule.has_diary)
      .sort((left, right) => Date.parse(right.end_at) - Date.parse(left.end_at));

    return { today, next, needsRecord };
  }, [schedules.data]);

  if (schedules.isLoading) return <LoadingScreen message="오늘의 일정을 불러오고 있어요." />;
  if (schedules.isError) {
    return <ErrorState message="홈 정보를 불러오지 못했습니다." onRetry={() => schedules.refetch()} />;
  }

  const goToSchedules = () => router.push('/(tabs)/schedules');

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>나의 일기</Text>
          <Text style={styles.title}>{user?.nickname ?? '사용자'}님, 오늘도 반가워요</Text>
          <Text style={styles.description}>오늘의 계획과 남겨야 할 기록을 한곳에서 확인하세요.</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.today.length}</Text>
            <Text style={styles.summaryLabel}>오늘 일정</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.needsRecord.length}</Text>
            <Text style={styles.summaryLabel}>기록 대기</Text>
          </View>
        </View>

        <SectionHeader title="오늘 일정" actionLabel="전체 보기" onPress={goToSchedules} />
        {summary.today.length > 0 ? (
          <View style={styles.list}>
            {summary.today.map((schedule) => <ScheduleCard key={schedule.id} schedule={schedule} />)}
          </View>
        ) : (
          <EmptyCard
            title="오늘은 등록된 일정이 없어요"
            description="새 일정을 만들거나 전체 일정을 확인해 보세요."
            actionLabel="일정 보기"
            onPress={goToSchedules}
          />
        )}

        <SectionHeader title="다음 일정" />
        {summary.next ? (
          <ScheduleCard schedule={summary.next} />
        ) : (
          <EmptyCard title="예정된 다음 일정이 없어요" description="새로운 하루를 계획해 보세요." />
        )}

        <SectionHeader title="기록을 기다리는 하루" />
        {summary.needsRecord.length > 0 ? (
          <View style={styles.list}>
            {summary.needsRecord.slice(0, 2).map((schedule) => (
              <ScheduleCard key={schedule.id} schedule={schedule} />
            ))}
          </View>
        ) : (
          <EmptyCard title="밀린 기록이 없어요" description="완료한 일정의 사진과 일기는 기록 기능에서 이어집니다." />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, actionLabel, onPress }: { title: string; actionLabel?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyCard({
  title,
  description,
  actionLabel,
  onPress,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {actionLabel && onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  heading: { gap: spacing.sm, marginBottom: spacing.lg },
  eyebrow: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', lineHeight: 34 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: spacing.lg,
  },
  summaryValue: { color: colors.primary, fontSize: 28, fontWeight: '800' },
  summaryLabel: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: spacing.xs },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sectionAction: { color: colors.primary, fontSize: 13, fontWeight: '700', paddingVertical: spacing.sm },
  list: { gap: spacing.md },
  emptyCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  emptyDescription: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
