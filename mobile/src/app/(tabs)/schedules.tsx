import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScheduleCard } from '@/features/schedules/schedule-card';
import { useSchedules } from '@/features/schedules/schedule-queries';
import { ScheduleFab } from '@/shared/components/schedule-fab';
import { EmptyState } from '@/shared/components/empty-state';
import { colors, spacing } from '@/shared/theme';
import { seoulDateKey } from '@/shared/utils/date';

// 일정 탭이 내다보는 기간. 이 안에 잡힌 하루를 모두 보여준다.
const UPCOMING_DAYS = 180;

function dateKeyAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return seoulDateKey(date.toISOString());
}

/**
 * 일정 탭. "앞으로 어떤 하루가 있지?"에 답하는 화면이다.
 *
 * 완료한 하루는 여기 두지 않는다. 계획은 일정 탭, 기억은 기록 탭으로 역할을 나눈다
 * (docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 2절).
 */
export default function SchedulesScreen() {
  const router = useRouter();
  // 오늘부터 앞으로만 받는다. 카드에 장소 이름을 보여주므로 장소까지 함께 받는다.
  const schedules = useSchedules({
    from: dateKeyAfter(0),
    to: dateKeyAfter(UPCOMING_DAYS),
    includePlaces: true,
  });

  // 오늘 진행 중인 하루와 앞으로 올 하루만 남긴다. 오늘 날짜라도 완료 처리했으면
  // 기록으로 넘어간 것이라 여기서 뺀다.
  const upcoming = (schedules.data ?? []).filter(
    (schedule) =>
      schedule.experience_phase === 'today' || schedule.experience_phase === 'upcoming',
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.title}>일정</Text>
          <Text style={styles.description}>앞으로 보낼 하루들입니다.</Text>
        </View>

        {upcoming.length > 0 ? (
          <View style={styles.list}>
            {upcoming.map((schedule) => (
              <ScheduleCard key={schedule.id} schedule={schedule} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="📅"
            title="아직 예정된 하루가 없어요"
            description="기다려지는 하루를 하나 만들어 보세요."
            actionLabel="하루 만들기"
            onAction={() => router.push('/schedules/new')}
          />
        )}

        {/* 지난 하루를 찾으러 온 사용자가 막다른 길에 서지 않도록 기록 탭을 가리킨다. */}
        <Pressable onPress={() => router.push('/(tabs)/records')} style={styles.recordsLink}>
          <Text style={styles.recordsText}>지난 하루는 기록에서 다시 볼 수 있어요 →</Text>
        </Pressable>
      </ScrollView>
      <ScheduleFab
        onPress={() => router.push({ pathname: '/schedules/new', params: { date: seoulDateKey(new Date().toISOString()) } })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  heading: { gap: spacing.sm, marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 14 },
  list: { gap: spacing.md },
  recordsLink: { alignItems: 'center', borderColor: colors.border, borderRadius: 14, borderWidth: 1, justifyContent: 'center', marginTop: spacing.lg, minHeight: 48 },
  recordsText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
});
