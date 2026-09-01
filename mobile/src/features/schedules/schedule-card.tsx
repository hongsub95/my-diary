import { StyleSheet, Text, View } from 'react-native';

import type { ScheduleView } from './schedule-adapter';
import { formatKoreanDateTime } from '@/shared/utils/date';
import { colors, spacing } from '@/shared/theme';

export function ScheduleCard({ schedule }: { schedule: ScheduleView }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.space}>{schedule.space_name}</Text>
        <Text style={[styles.status, schedule.status === 'completed' && styles.completed]}>
          {schedule.status === 'planned' ? '예정' : schedule.status === 'completed' ? '완료' : '취소'}
        </Text>
      </View>
      <Text style={styles.title}>{schedule.title}</Text>
      <Text style={styles.date}>{formatKoreanDateTime(schedule.start_at)}</Text>
      <Text style={styles.description}>{schedule.description}</Text>
      <Text style={styles.meta}>장소 {schedule.place_count}곳 · {schedule.has_diary ? '일기 작성됨' : '일기 미작성'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, padding: spacing.lg },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  space: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  status: { backgroundColor: colors.primarySoft, borderRadius: 999, color: colors.primary, fontSize: 12, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  completed: { backgroundColor: '#E8F5EE', color: '#238257' },
  title: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: spacing.md },
  date: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
  description: { color: colors.muted, fontSize: 14, marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 12, marginTop: spacing.md },
});
