import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScheduleCard } from '@/features/schedules/schedule-card';
import { ChristmasBackdrop } from '@/features/seasonal/christmas-backdrop';
import { NIGHT_TEXT, NIGHT_TEXT_SHADOW } from '@/features/seasonal/scene-colors';
import { SeasonalHeader } from '@/features/seasonal/seasonal-header';
import { SnowCapped } from '@/features/seasonal/snow-cap';
import { useSeasonalScreen } from '@/features/seasonal/use-seasonal-screen';
import { useSchedules } from '@/features/schedules/schedule-queries';
import { getApiError } from '@/shared/api/api-error';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import { ScheduleFab } from '@/shared/components/schedule-fab';
import { EmptyState } from '@/shared/components/empty-state';
import { LoadingIndicator } from '@/shared/components/loading-indicator';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { seoulDateKey } from '@/shared/utils/date';

// 일정 탭이 내다보는 기간. 이 안에 잡힌 하루를 모두 보여준다.
const UPCOMING_DAYS = 180;

function dateKeyAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return seoulDateKey(date.toISOString());
}

/** 완료한 하루는 기록 탭에 두고, 오늘과 앞으로 올 하루를 보여 준다. */
export default function SchedulesScreen() {
  const router = useRouter();
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{ notice?: string }>();
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();
  // 계절 배경. 화면 전체에 하늘이 깔리면 카드 밖 글씨만 밤 색으로 바꾸고 카드 안은 그대로 둔다.
  const seasonal = useSeasonalScreen('schedules');
  const dark = seasonal.onDarkSky;
  useEffect(() => {
    if (typeof params.notice === 'string' && params.notice) { showSnackbar(params.notice); router.setParams({ notice: undefined }); }
  }, [params.notice, router, showSnackbar]);
  const schedules = useSchedules({
    from: dateKeyAfter(0),
    to: dateKeyAfter(UPCOMING_DAYS),
    includePlaces: true,
  });
  const todaySchedules = (schedules.data ?? []).filter(schedule => schedule.experience_phase === 'today');
  const upcomingSchedules = (schedules.data ?? []).filter(schedule => schedule.experience_phase === 'upcoming');
  const hasSchedules = todaySchedules.length + upcomingSchedules.length > 0;

  return (
    <View style={styles.root}>
    {seasonal.full && <ChristmasBackdrop night={seasonal.night} />}
    <SafeAreaView edges={['top']} style={[styles.safeArea, seasonal.full && styles.transparent]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {seasonal.showGreeting && <SeasonalHeader night={dark} onNotice={showSnackbar} />}
        <View style={styles.heading}>
          <View style={styles.headingIcon}>
            <SymbolView name={{ ios: 'point.topleft.down.to.point.bottomright.curvepath', android: 'route', web: 'route' }} size={22} tintColor={palette.primaryDark} fallback={<Text style={styles.iconFallback}>↝</Text>} />
          </View>
          <View style={styles.headingCopy}>
            <Text accessibilityRole="header" style={[styles.title, dark && styles.titleNight]}>일정</Text>
            <Text style={[styles.description, dark && styles.descriptionNight]}>갈 곳을 담아, 하루를 기다려요.</Text>
          </View>
        </View>

        {schedules.isLoading ? (
          <View style={styles.stateCard}><LoadingIndicator message="예정된 하루를 불러오고 있어요." stacked /></View>
        ) : schedules.isError ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>{getApiError(schedules.error).message}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void schedules.refetch(); }} style={styles.retryButton}><Text style={styles.retryText}>다시 불러오기</Text></Pressable>
          </View>
        ) : hasSchedules ? (
          <View style={styles.sections}>
            {todaySchedules.length > 0 && <View>
              <View style={styles.sectionHeader}><Text accessibilityRole="header" style={[styles.sectionTitle, dark && styles.titleNight]}>오늘 보낼 하루</Text><Text style={[styles.count, dark && styles.countNight]}>{todaySchedules.length}개</Text></View>
              <View style={styles.list}>{todaySchedules.map(schedule => <SnowCapped key={schedule.id} show={seasonal.full} night={seasonal.night}><ScheduleCard schedule={schedule} /></SnowCapped>)}</View>
            </View>}
            {upcomingSchedules.length > 0 && <View>
              <View style={styles.sectionHeader}><Text accessibilityRole="header" style={[styles.sectionTitle, dark && styles.titleNight]}>다가오는 하루</Text><Text style={[styles.count, dark && styles.countNight]}>{upcomingSchedules.length}개</Text></View>
              <View style={styles.list}>{upcomingSchedules.map(schedule => <SnowCapped key={schedule.id} show={seasonal.full} night={seasonal.night}><ScheduleCard schedule={schedule} /></SnowCapped>)}</View>
            </View>}
          </View>
        ) : (
          <SnowCapped show={seasonal.full} night={seasonal.night}>
            <View style={styles.emptyCard}>
              <EmptyState icon="📅" title="아직 예정된 하루가 없어요" description="오른쪽 아래 ＋ 를 눌러 기다려지는 하루를 만들어 보세요." />
            </View>
          </SnowCapped>
        )}

        <SnowCapped show={seasonal.full} night={seasonal.night} style={styles.recordsLinkWrap}>
        <Pressable accessibilityRole="link" onPress={() => router.push('/(tabs)/records')} style={({ pressed }) => [styles.recordsLink, pressed && styles.pressed]}>
          <View style={styles.linkIcon}>
            <SymbolView name={{ ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' }} size={20} tintColor={colors.muted} fallback={<Text style={styles.iconFallback}>▤</Text>} />
          </View>
          <View style={styles.linkCopy}><Text style={styles.linkTitle}>지난 하루가 그리울 땐</Text><Text style={styles.recordsText}>기록에서 다시 만나요.</Text></View>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={colors.muted} fallback={<Text style={styles.recordsText}>›</Text>} />
        </Pressable>
        </SnowCapped>
      </ScrollView>
      <ScheduleFab onPress={() => router.push({ pathname: '/schedules/new', params: { date: seoulDateKey(new Date().toISOString()) } })} />
      <Snackbar notice={notice} onDismiss={dismissSnackbar} />
    </SafeAreaView>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1, backgroundColor: colors.background },
  transparent: { backgroundColor: 'transparent' },
  content: { padding: spacing.lg, paddingBottom: 132, paddingTop: spacing.xl },
  heading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  headingIcon: { alignItems: 'center', backgroundColor: palette.primarySoft, borderRadius: radii.lg, height: 48, justifyContent: 'center', width: 48 },
  headingCopy: { flex: 1 },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold },
  description: { color: colors.muted, fontSize: typography.body, lineHeight: 22, marginTop: spacing.xs },
  titleNight: { color: NIGHT_TEXT.strong, ...NIGHT_TEXT_SHADOW },
  descriptionNight: { color: NIGHT_TEXT.muted, ...NIGHT_TEXT_SHADOW },
  sections: { gap: spacing.xl },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold },
  count: { color: palette.primaryDark, fontSize: 12, fontWeight: typography.semibold },
  countNight: { color: NIGHT_TEXT.accent, ...NIGHT_TEXT_SHADOW },
  list: { gap: spacing.md },
  stateCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.card, gap: spacing.md, padding: spacing.xl },
  stateText: { color: colors.muted, fontSize: typography.body, lineHeight: 22, textAlign: 'center' },
  retryButton: { backgroundColor: palette.primarySoft, borderRadius: radii.md, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.lg },
  retryText: { color: palette.primaryDark, fontSize: typography.body, fontWeight: typography.semibold },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radii.card, paddingVertical: spacing.md },
  // 바깥 여백은 눈 얹는 틀에 둔다. 카드에 두면 눈이 카드 윗변이 아니라 여백 위에 뜬다.
  recordsLinkWrap: { marginTop: spacing.xl },
  recordsLink: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radii.card, flexDirection: 'row', gap: spacing.md, minHeight: 76, padding: spacing.md },
  linkIcon: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.md, height: 40, justifyContent: 'center', width: 40 },
  linkCopy: { flex: 1 },
  linkTitle: { color: colors.text, fontSize: typography.body, fontWeight: typography.semibold, lineHeight: 22 },
  recordsText: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 2 },
  iconFallback: { color: palette.primaryDark, fontSize: 20 },
  pressed: { opacity: 0.8 },
});
