import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PhaseTag, phaseKind, phaseLabel } from './phase-tag';
import type { ScheduleView } from './schedule-adapter';
import { formatKoreanDateTime } from '@/shared/utils/date';
import { colors, radii, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

export function ScheduleCard({ schedule }: { schedule: ScheduleView }) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/schedules/[id]', params: { id: schedule.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <Text style={styles.space}>{schedule.space_name}</Text>
        {/* status가 아니라 experience_phase로 정한다. 날짜가 지났는데 완료하지 않은 하루는
            status가 planned라도 "예정"이 아니라 "남기기 전"이다. 캘린더 칩과 같은 기준이다. */}
        <PhaseTag size="badge" kind={phaseKind(schedule.experience_phase)} label={phaseLabel(schedule.experience_phase)} />
      </View>
      <Text style={styles.title}>{schedule.title}</Text>
      <Text style={styles.date}>{formatKoreanDateTime(schedule.start_at)}</Text>
      <Text style={styles.description}>{schedule.description}</Text>
      <Text style={styles.meta}>장소 {schedule.place_count}곳 · {schedule.has_diary ? '기록 있음' : '기록 없음'}</Text>
    </Pressable>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, elevation: 3, minHeight: 124, padding: spacing.lg, shadowColor: '#432F28', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  space: { color: palette.primary, fontSize: 14, fontWeight: '600' },
  title: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: spacing.md },
  date: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
  description: { color: colors.muted, fontSize: 14, marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 12, marginTop: spacing.md },
  pressed: { opacity: 0.8 },
});
