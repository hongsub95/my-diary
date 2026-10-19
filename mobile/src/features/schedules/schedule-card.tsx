import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PhaseTag, phaseKind, phaseLabel } from './phase-tag';
import type { ScheduleView } from './schedule-adapter';
import { formatKoreanDateTime } from '@/shared/utils/date';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';

/** 날짜와 공간, 사용자가 정한 장소 순서를 한 장에 담는다. */
export function ScheduleCard({ schedule }: { schedule: ScheduleView }) {
  const router = useRouter();
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  const places = [...schedule.places].sort((a, b) => a.sortOrder - b.sortOrder);
  const shownPlaces = places.slice(0, 3);
  const isPlan = schedule.experience_phase === 'upcoming' || schedule.experience_phase === 'today';
  const footerLabel = schedule.experience_phase === 'canceled' ? '취소된 하루예요'
    : schedule.has_diary ? '남겨 둔 기록이 있어요'
      : schedule.experience_phase === 'recorded' ? '사진과 순간으로 남긴 하루'
        : schedule.experience_phase === 'record_pending' ? '사진 한 장으로 하루를 남겨 보세요.'
          : schedule.experience_phase === 'today' ? '오늘의 하루를 채워 가요.' : '기다려지는 하루';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/schedules/[id]', params: { id: schedule.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.dateTile}>
          <Text style={styles.month}>{Number(schedule.dateKey.slice(5, 7))}월</Text>
          <Text style={styles.day}>{Number(schedule.dateKey.slice(8))}</Text>
        </View>
        <View style={styles.identity}>
          <View style={styles.spaceRow}>
            <SymbolView name={{ ios: 'house', android: 'home', web: 'home' }} size={14} tintColor={colors.muted} fallback={<Text style={styles.space}>⌂</Text>} />
            <Text style={styles.space} numberOfLines={1}>{schedule.space_name}</Text>
          </View>
          <Text style={styles.title}>{schedule.title}</Text>
        </View>
      </View>
      <View style={styles.details}>
        <PhaseTag size="badge" kind={phaseKind(schedule.experience_phase)} label={phaseLabel(schedule.experience_phase)} />
        <Text style={styles.date}>{formatKoreanDateTime(schedule.start_at)}</Text>
      </View>
      {schedule.description ? <Text style={styles.description} numberOfLines={2}>{schedule.description}</Text> : null}
      <View style={styles.route}>
        <View style={styles.routeHeading}>
          <View style={styles.routeLabel}>
            <SymbolView name={{ ios: 'point.topleft.down.to.point.bottomright.curvepath', android: 'route', web: 'route' }} size={16} tintColor={palette.primaryDark} fallback={<Text style={styles.routeTitle}>↝</Text>} />
            <Text style={styles.routeTitle}>장소 흐름</Text>
          </View>
          <Text style={styles.placeCount}>{schedule.place_count}곳</Text>
        </View>
        {shownPlaces.length ? (
          <View style={styles.stops}>
            {shownPlaces.map((place, index) => (
              <View key={place.id} style={styles.stop}>
                <View style={styles.step}><Text style={styles.stepText}>{index + 1}</Text></View>
                <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
              </View>
            ))}
            {schedule.place_count > shownPlaces.length && <Text style={styles.remaining}>외 {schedule.place_count - shownPlaces.length}곳</Text>}
          </View>
        ) : <Text style={styles.routeNote}>{schedule.place_count > 0 ? '장소는 상세에서 확인해 보세요.' : isPlan ? '어디로 갈지 천천히 정해 보세요.' : '이 하루에는 장소가 없어요.'}</Text>}
      </View>
      <View style={styles.footer}>
        <Text style={styles.meta}>{footerLabel}</Text>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={colors.muted} fallback={<Text style={styles.meta}>›</Text>} />
      </View>
    </Pressable>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.card, elevation: 2, padding: spacing.lg, shadowColor: '#432F28', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.04, shadowRadius: 14 },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  dateTile: { alignItems: 'center', backgroundColor: palette.primarySoft, borderRadius: radii.lg, justifyContent: 'center', minHeight: 64, width: 58 },
  month: { color: palette.primaryDark, fontSize: 12, fontWeight: typography.semibold },
  day: { color: palette.primaryDark, fontSize: typography.heading, fontWeight: typography.semibold, marginTop: spacing.xs },
  identity: { flex: 1, minWidth: 0 },
  spaceRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  space: { color: colors.muted, flexShrink: 1, fontSize: 12 },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold, lineHeight: 26, marginTop: spacing.xs },
  details: { alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md },
  date: { color: colors.text, fontSize: typography.body, fontWeight: typography.regular, lineHeight: 21 },
  description: { color: colors.muted, fontSize: typography.body, lineHeight: 22, marginTop: spacing.sm },
  route: { backgroundColor: colors.surfaceMuted, borderRadius: radii.lg, marginTop: spacing.lg, padding: spacing.md },
  routeHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  routeLabel: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  routeTitle: { color: palette.primaryDark, fontSize: 12, fontWeight: typography.semibold },
  placeCount: { color: colors.muted, fontSize: 12 },
  stops: { gap: spacing.sm, marginTop: spacing.md },
  stop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  step: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.full, minHeight: 24, justifyContent: 'center', minWidth: 24, paddingHorizontal: spacing.xs },
  stepText: { color: palette.primaryDark, fontSize: 12, fontWeight: typography.semibold },
  placeName: { color: colors.text, flex: 1, fontSize: typography.body, lineHeight: 21 },
  remaining: { color: colors.muted, fontSize: 12, marginLeft: 32 },
  routeNote: { color: colors.muted, fontSize: typography.body, lineHeight: 21, marginTop: spacing.sm },
  footer: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', marginTop: spacing.md },
  meta: { color: colors.muted, flexShrink: 1, fontSize: 12, lineHeight: 19 },
  pressed: { opacity: 0.8 },
});
