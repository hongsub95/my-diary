import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScheduleCard } from '@/features/schedules/schedule-card';
import { useSchedules } from '@/features/schedules/schedule-queries';
import { ScheduleFab } from '@/shared/components/schedule-fab';
import { colors, spacing } from '@/shared/theme';
import { seoulDateKey } from '@/shared/utils/date';

export default function SchedulesScreen() {
  const router = useRouter();
  // 기간을 주지 않으면 서버가 이번 달로 잡는다(API_SPEC 5.1). 카드에 장소 이름을
  // 보여주므로 장소까지 함께 받는다.
  const schedules = useSchedules({ includePlaces: true });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.title}>일정</Text>
          <Text style={styles.description}>이번 달 일정입니다.</Text>
        </View>
        <View style={styles.list}>
          {schedules.data?.map((schedule) => <ScheduleCard key={schedule.id} schedule={schedule} />)}
        </View>
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
});
