import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiarySection } from '@/features/diaries/diary-section';
import { useSchedule } from '@/features/schedules/schedule-queries';
import { getApiError } from '@/shared/api/api-error';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { colors, spacing } from '@/shared/theme';
import { formatKoreanDateTime } from '@/shared/utils/date';

const PHASE_LABELS: Record<string, string> = {
  upcoming: '예정',
  today: '오늘',
  record_pending: '기록을 기다리는 중',
  recorded: '기록함',
  canceled: '취소됨',
};

/**
 * 일정 상세. 계획(장소)과 기록(사진·일기·타임라인)을 한 화면에서 다룬다.
 *
 * 하단 탭을 벗어난 별도 화면이라 뒤로가기로 돌아온다. 일정 탭과 기록 탭의 카드가
 * 모두 여기로 들어온다.
 */
export default function ScheduleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const scheduleId = Number(rawId);

  const schedule = useSchedule(scheduleId);

  if (schedule.isLoading) return <LoadingScreen message="하루를 불러오고 있어요." />;
  if (schedule.isError || !schedule.data) {
    return (
      <ErrorState
        message={
          schedule.error ? getApiError(schedule.error).message : '일정을 찾을 수 없습니다.'
        }
        onRetry={() => schedule.refetch()}
      />
    );
  }

  const day = schedule.data;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}>
          <Text style={styles.backMark}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>하루</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.phase}>
            {PHASE_LABELS[day.experience_phase] ?? day.experience_phase} · {day.space_name}
          </Text>
          <Text style={styles.title}>{day.title}</Text>
          <Text style={styles.when}>{formatKoreanDateTime(day.start_at)}</Text>
          {day.description ? <Text style={styles.description}>{day.description}</Text> : null}
        </View>

        {/* 계획한 장소. 방문 순서는 1부터 보여준다. sort_order는 0부터 시작하는 내부 값이다. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>장소</Text>
          {day.places.length > 0 ? (
            day.places.map((place, index) => (
              <View key={place.id} style={styles.place}>
                <Text style={styles.placeOrder}>{index + 1}</Text>
                <View style={styles.placeBody}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  {place.address ? <Text style={styles.placeAddress}>{place.address}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.empty}>아직 담은 장소가 없어요.</Text>
          )}
        </View>

        <DiarySection scheduleId={scheduleId} dateKey={day.dateKey} places={day.places} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  backMark: { color: colors.text, fontSize: 28, lineHeight: 30 },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },

  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 60 },
  summary: { gap: 5 },
  phase: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  when: { color: colors.muted, fontSize: 13 },
  description: { color: colors.text, fontSize: 13, lineHeight: 21, marginTop: 4 },

  section: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  empty: { color: colors.muted, fontSize: 12 },

  place: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  placeOrder: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 13, color: colors.primary, fontSize: 11, fontWeight: '800', height: 26, lineHeight: 26, textAlign: 'center', width: 26 },
  placeBody: { flex: 1, gap: 2 },
  placeName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  placeAddress: { color: colors.muted, fontSize: 11 },
});
