import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { useSchedules } from '@/features/schedules/schedule-queries';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { colors, spacing } from '@/shared/theme';
import { seoulDateKey } from '@/shared/utils/date';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const schedules = useSchedules({ includePlaces: true });

  const day = useMemo(() => {
    const items = schedules.data ?? [];
    const now = new Date();
    const todayKey = seoulDateKey(now.toISOString());
    const today = items
      .filter((item) => item.dateKey === todayKey && item.status !== 'canceled')
      .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))[0];
    const next = items
      .filter((item) => item.status === 'planned' && Date.parse(item.start_at) > now.getTime())
      .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))[0];
    const recordPending = items
      .filter((item) => item.status === 'completed' && !item.has_diary)
      .sort((a, b) => Date.parse(b.end_at) - Date.parse(a.end_at))[0];
    return { today, next, recordPending };
  }, [schedules.data]);

  if (schedules.isLoading) return <LoadingScreen message="오늘의 하루를 불러오고 있어요." />;
  if (schedules.isError) {
    return <ErrorState message="하루 정보를 불러오지 못했어요." onRetry={() => schedules.refetch()} />;
  }

  const activeDay = day.today ?? day.next;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>나의 일기</Text>
            <Text style={styles.category}>장소 기반 데이북</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user?.nickname?.slice(0, 1) ?? '나'}</Text></View>
        </View>

        {activeDay ? (
          <DayHero
            schedule={activeDay}
            isToday={Boolean(day.today)}
            onPress={() => router.push({ pathname: '/day/today', params: { id: String(activeDay.id) } })}
          />
        ) : (
          <EmptyHero onPress={() => router.push('/schedules/new')} />
        )}

        {activeDay?.places.length ? (
          <View style={styles.routeCard}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.eyebrow}>DAY ROUTE</Text>
                <Text style={styles.sectionTitle}>이 장소들을 따라가요</Text>
              </View>
              <Text style={styles.routeCount}>{activeDay.places.length}곳</Text>
            </View>
            {activeDay.places.slice(0, 4).map((place, index) => (
              <View key={place.id} style={styles.placeRow}>
                <View style={[styles.placeNumber, index === 0 && styles.placeNumberActive]}>
                  <Text style={[styles.placeNumberText, index === 0 && styles.placeNumberTextActive]}>{index + 1}</Text>
                </View>
                <View style={styles.placeCopy}>
                  <Text style={styles.placeName}>{place.name}</Text>
                  <Text numberOfLines={1} style={styles.placeMeta}>{place.memo || place.address || '이 하루에 담긴 장소'}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            ))}
          </View>
        ) : activeDay ? (
          <Pressable onPress={() => router.push('/schedules/new')} style={styles.placePrompt}>
            <Text style={styles.placePromptIcon}>⌖</Text>
            <View style={styles.placeCopy}>
              <Text style={styles.placeName}>이 하루에 장소를 담아보세요</Text>
              <Text style={styles.placeMeta}>갈 곳을 고르면 하루의 흐름이 보여요.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ) : null}

        {day.recordPending ? (
          <Pressable onPress={() => router.push('/(tabs)/records')} style={styles.recordPrompt}>
            <View style={styles.recordPhoto}><Text style={styles.recordPhotoText}>기억</Text></View>
            <View style={styles.recordCopy}>
              <Text style={styles.eyebrow}>기록 대기</Text>
              <Text numberOfLines={1} style={styles.recordTitle}>{day.recordPending.title}</Text>
              <Text style={styles.recordDescription}>사진 한 장이나 한 문장으로 시작해도 충분해요.</Text>
            </View>
            <Text style={styles.recordAction}>남기기</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/(tabs)/records')} style={styles.memoryLink}>
            <Text style={styles.memoryIcon}>◫</Text>
            <View style={styles.recordCopy}>
              <Text style={styles.memoryTitle}>우리가 보낸 하루들</Text>
              <Text style={styles.recordDescription}>지난 장소와 장면을 다시 꺼내보세요.</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DayHero({ schedule, isToday, onPress }: { schedule: ScheduleView; isToday: boolean; onPress: () => void }) {
  const firstPlace = schedule.places[0]?.name;
  return (
    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <View style={styles.heroPhoto}><View style={styles.heroHill} /></View>
      <Text style={styles.heroEyebrow}>{isToday ? '오늘의 하루' : '다가오는 하루'}</Text>
      <Text style={styles.heroTitle}>{schedule.title}</Text>
      <Text style={styles.heroMeta}>{firstPlace ? `${firstPlace}에서 시작 · ${schedule.place_count}개 장소` : '어떤 장소를 담을지 정해보세요.'}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.heroButton}>
        <Text style={styles.heroButtonText}>{isToday ? '오늘의 하루 보기' : '계획 살펴보기'}</Text>
        <Text style={styles.heroButtonArrow}>→</Text>
      </Pressable>
    </View>
  );
}

function EmptyHero({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.emptyHero}>
      <Text style={styles.eyebrow}>새로운 하루</Text>
      <Text style={styles.emptyHeroTitle}>어떤 하루를{"\n"}보내고 싶나요?</Text>
      <Text style={styles.emptyHeroDescription}>장소와 사람을 담아 앞으로의 하루를 만들어 보세요.</Text>
      <Pressable onPress={onPress} style={styles.emptyHeroButton}><Text style={styles.emptyHeroButtonText}>＋ 하루 만들기</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
  brand: { color: colors.text, fontFamily: 'serif', fontSize: 20, fontWeight: '800' },
  category: { color: colors.muted, fontSize: 11, marginTop: 2 },
  avatar: { alignItems: 'center', backgroundColor: colors.sage, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  eyebrow: { color: colors.primaryDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  hero: { backgroundColor: colors.ink, borderRadius: 28, minHeight: 294, overflow: 'hidden', padding: 24 },
  heroGlow: { backgroundColor: '#68424A', borderRadius: 130, height: 220, opacity: 0.45, position: 'absolute', right: -80, top: -90, width: 220 },
  heroPhoto: { backgroundColor: '#7F8E7D', borderRadius: 70, bottom: -30, height: 190, opacity: 0.6, position: 'absolute', right: -24, transform: [{ rotate: '-12deg' }], width: 170 },
  heroHill: { backgroundColor: '#526353', borderRadius: 70, bottom: -25, height: 110, position: 'absolute', right: -5, width: 160 },
  heroEyebrow: { color: '#E9B8C3', fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginTop: 15 },
  heroTitle: { color: '#FFFFFF', fontFamily: 'serif', fontSize: 30, fontWeight: '800', lineHeight: 38, marginTop: 10, maxWidth: '78%' },
  heroMeta: { color: '#D8D0CB', fontSize: 12, lineHeight: 18, marginTop: 10, maxWidth: '72%' },
  heroButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 14, flexDirection: 'row', gap: 12, marginTop: 25, minHeight: 45, paddingHorizontal: 16 },
  heroButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  heroButtonArrow: { color: '#FFFFFF', fontSize: 18 },
  emptyHero: { backgroundColor: colors.ink, borderRadius: 28, minHeight: 290, padding: 25 },
  emptyHeroTitle: { color: '#FFFFFF', fontFamily: 'serif', fontSize: 31, fontWeight: '800', lineHeight: 40, marginTop: 12 },
  emptyHeroDescription: { color: '#D8D0CB', fontSize: 13, lineHeight: 20, marginTop: 12, maxWidth: 250 },
  emptyHeroButton: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: 14, marginTop: 25, paddingHorizontal: 18, paddingVertical: 14 },
  emptyHeroButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  routeCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, marginTop: 16, padding: 18 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  routeCount: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  placeRow: { alignItems: 'center', flexDirection: 'row', minHeight: 66 },
  placeNumber: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 15, borderWidth: 2, height: 30, justifyContent: 'center', width: 30 },
  placeNumberActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  placeNumberText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  placeNumberTextActive: { color: colors.primaryDark },
  placeCopy: { flex: 1, marginLeft: 12 },
  placeName: { color: colors.text, fontSize: 14, fontWeight: '800' },
  placeMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  chevron: { color: colors.muted, fontSize: 25, marginLeft: 8 },
  placePrompt: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', marginTop: 15, minHeight: 82, padding: 15 },
  placePromptIcon: { color: colors.primary, fontSize: 27 },
  recordPrompt: { alignItems: 'center', backgroundColor: colors.sand, borderRadius: 20, flexDirection: 'row', marginTop: 15, padding: 13 },
  recordPhoto: { alignItems: 'center', backgroundColor: '#B77868', borderRadius: 15, height: 62, justifyContent: 'center', width: 62 },
  recordPhotoText: { color: '#FFFFFF', fontFamily: 'serif', fontSize: 11, fontWeight: '800' },
  recordCopy: { flex: 1, marginLeft: 12 },
  recordTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 4 },
  recordDescription: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  recordAction: { backgroundColor: colors.surface, borderRadius: 10, color: colors.primaryDark, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 9 },
  memoryLink: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', marginTop: 15, padding: 16 },
  memoryIcon: { color: colors.sage, fontSize: 30 },
  memoryTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
