import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSchedules } from '@/features/schedules/schedule-queries';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { colors, spacing } from '@/shared/theme';

export default function TodayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const schedules = useSchedules({ includePlaces: true });
  const id = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const schedule = useMemo(() => schedules.data?.find((item) => item.id === id), [id, schedules.data]);

  if (schedules.isLoading) return <LoadingScreen message="오늘의 장소를 불러오고 있어요." />;
  if (schedules.isError) return <ErrorState message="오늘의 하루를 불러오지 못했어요." onRetry={() => schedules.refetch()} />;
  if (!schedule) return <ErrorState message="선택한 하루를 찾을 수 없어요." onRetry={() => router.back()} />;

  const nextIndex = Math.max(0, schedule.places.findIndex((place) => !place.visited));
  const nextPlace = schedule.places[nextIndex];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}><Text style={styles.headerButtonText}>‹</Text></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerEyebrow}>오늘의 하루</Text><Text numberOfLines={1} style={styles.headerTitle}>{schedule.title}</Text></View>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {nextPlace ? (
          <>
            <Text style={styles.live}>● 오늘 진행 중</Text>
            <Text style={styles.title}>다음은{"\n"}{nextPlace.name}이에요.</Text>
            <Text style={styles.description}>{nextPlace.plannedTime || '다음 순서'} · 장소 흐름을 확인해 보세요.</Text>
            <View style={styles.nextCard}>
              <View style={styles.photo}><View style={styles.photoLand} /><Text style={styles.photoLabel}>다음 장소 · {nextIndex + 1}</Text></View>
              <View style={styles.nextCopy}>
                <Text style={styles.eyebrow}>NEXT PLACE</Text>
                <Text style={styles.nextTitle}>{nextPlace.name}</Text>
                <Text numberOfLines={2} style={styles.address}>⌖ {nextPlace.address || '주소 정보가 아직 없어요.'}</Text>
                <View style={styles.actions}>
                  <Pressable style={styles.secondaryButton}><Text style={styles.secondaryText}>길 찾기</Text></Pressable>
                  <Pressable style={styles.primaryButton}><Text style={styles.primaryText}>도착했어요</Text></Pressable>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.eyebrow}>TODAY</Text>
            <Text style={styles.title}>오늘의 장소가{"\n"}아직 비어 있어요.</Text>
            <Text style={styles.description}>일정 상세에서 장소를 추가하면 이곳에 순서대로 나타납니다.</Text>
          </View>
        )}

        <View style={styles.flowCard}>
          <View style={styles.flowHeader}>
            <View><Text style={styles.eyebrow}>TODAY FLOW</Text><Text style={styles.flowTitle}>오늘의 흐름</Text></View>
            <Text style={styles.flowCount}>{schedule.places.filter((place) => place.visited).length} / {schedule.places.length}</Text>
          </View>
          {schedule.places.map((place, index) => (
            <View key={place.id} style={[styles.flowRow, index === nextIndex && styles.flowRowActive]}>
              <View style={[styles.flowNumber, place.visited && styles.flowNumberDone]}>
                <Text style={[styles.flowNumberText, place.visited && styles.flowNumberTextDone]}>{place.visited ? '✓' : index + 1}</Text>
              </View>
              <Text style={styles.flowTime}>{place.plannedTime || '—'}</Text>
              <View style={styles.flowCopy}><Text style={styles.flowName}>{place.name}</Text><Text numberOfLines={1} style={styles.flowMemo}>{place.memo || place.address || '장소 메모 없음'}</Text></View>
              {index === nextIndex ? <Text style={styles.nextBadge}>다음</Text> : null}
            </View>
          ))}
        </View>

        <Pressable onPress={() => router.push('/(tabs)/records')} style={styles.photoAction}>
          <Text style={styles.photoActionIcon}>▣</Text>
          <View style={styles.photoActionCopy}><Text style={styles.photoActionTitle}>지금의 장면 남기기</Text><Text style={styles.photoActionText}>사진은 오늘의 기록에 바로 담겨요.</Text></View>
          <Text style={styles.photoActionArrow}>›</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 62, paddingHorizontal: spacing.sm },
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  headerButtonText: { color: colors.text, fontSize: 35, lineHeight: 38 },
  headerCopy: { alignItems: 'center', flex: 1 },
  headerEyebrow: { color: colors.primaryDark, fontSize: 9, fontWeight: '800' },
  headerTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: 60 },
  live: { color: colors.sage, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: colors.text, fontFamily: 'serif', fontSize: 31, fontWeight: '800', lineHeight: 39, marginTop: 9 },
  description: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  eyebrow: { color: colors.primaryDark, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  nextCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 23, borderWidth: 1, marginTop: 20, overflow: 'hidden' },
  photo: { backgroundColor: '#7D907A', height: 170, overflow: 'hidden' },
  photoLand: { backgroundColor: '#455C49', borderRadius: 160, bottom: -80, height: 190, opacity: 0.55, position: 'absolute', right: -40, transform: [{ rotate: '-9deg' }], width: 320 },
  photoLabel: { bottom: 14, color: '#FFFFFF', fontSize: 10, fontWeight: '800', position: 'absolute', right: 15 },
  nextCopy: { padding: 18 },
  nextTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 },
  address: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 17 },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 13, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46 },
  secondaryText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 13, flex: 1, justifyContent: 'center', minHeight: 46 },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  empty: { paddingVertical: 20 },
  flowCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, marginTop: 16, padding: 16 },
  flowHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  flowTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 3 },
  flowCount: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  flowRow: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', minHeight: 62, paddingHorizontal: 6 },
  flowRowActive: { backgroundColor: '#FBF6F3' },
  flowNumber: { alignItems: 'center', borderColor: colors.border, borderRadius: 14, borderWidth: 2, height: 28, justifyContent: 'center', width: 28 },
  flowNumberDone: { backgroundColor: colors.sage, borderColor: colors.sage },
  flowNumberText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  flowNumberTextDone: { color: '#FFFFFF' },
  flowTime: { color: colors.muted, fontSize: 9, marginLeft: 9, width: 39 },
  flowCopy: { flex: 1 },
  flowName: { color: colors.text, fontSize: 12, fontWeight: '800' },
  flowMemo: { color: colors.muted, fontSize: 9, marginTop: 3 },
  nextBadge: { backgroundColor: colors.primarySoft, borderRadius: 10, color: colors.primaryDark, fontSize: 8, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4 },
  photoAction: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 18, flexDirection: 'row', marginTop: 14, minHeight: 66, padding: 14 },
  photoActionIcon: { color: '#E9B8C3', fontSize: 24 },
  photoActionCopy: { flex: 1, marginLeft: 12 },
  photoActionTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  photoActionText: { color: '#CFC7C2', fontSize: 9, marginTop: 4 },
  photoActionArrow: { color: '#FFFFFF', fontSize: 25 },
});
