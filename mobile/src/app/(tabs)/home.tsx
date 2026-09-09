import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { useDiaryFeed } from '@/features/diaries/diary-queries';
import type { RecordView } from '@/features/diaries/diary-adapter';
import { useSchedules } from '@/features/schedules/schedule-queries';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing } from '@/shared/theme';
import { seoulDateKey } from '@/shared/utils/date';

// 홈이 내다보는 기간. 오늘부터 이만큼 안에 다음 약속이 있으면 보여준다.
const UPCOMING_DAYS = 60;

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});

function dateKeyAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return seoulDateKey(date.toISOString());
}

type Focus =
  | { kind: 'today'; schedule: ScheduleView }
  | { kind: 'record'; record: RecordView }
  | { kind: 'upcoming'; schedule: ScheduleView }
  | { kind: 'empty' };

/**
 * 지금 무엇을 보여줄지 하나만 고른다.
 *
 * 홈은 여러 정보를 나열하는 대시보드가 아니라 "지금 무엇을 하면 되는지"를 하나로
 * 제시하는 화면이다(docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 3.1절). 그래서 후보가
 * 여럿이어도 우선순위대로 하나만 고른다.
 *
 * 우선순위: 오늘 > 기록 대기 > 다음 약속 > 없음. 진행 중인 하루가 미래 일정보다
 * 앞서야 하고, 다녀왔는데 안 남긴 하루는 다음 약속보다 먼저 눈에 띄어야 한다(7절).
 * 웹의 frontend/src/features/home/HomePage.jsx와 같은 규칙이다.
 */
function resolveFocus(schedules: ScheduleView[], pendingRecord: RecordView | null): Focus {
  const today = schedules.filter((schedule) => schedule.experience_phase === 'today');
  if (today.length > 0) {
    // 오늘 일정이 여럿이면 시작이 가장 가까운 하나만 주 카드로 쓴다(7절).
    const [nearest] = [...today].sort(
      (a, b) => Date.parse(a.start_at) - Date.parse(b.start_at),
    );
    return { kind: 'today', schedule: nearest };
  }

  if (pendingRecord) return { kind: 'record', record: pendingRecord };

  const upcoming = schedules
    .filter((schedule) => schedule.experience_phase === 'upcoming')
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  if (upcoming.length > 0) return { kind: 'upcoming', schedule: upcoming[0] };

  return { kind: 'empty' };
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // 오늘부터 앞으로의 일정만 본다. 홈은 지난 계획을 되짚는 화면이 아니다.
  const schedules = useSchedules({
    from: dateKeyAfter(0),
    to: dateKeyAfter(UPCOMING_DAYS),
    includePlaces: true,
  });

  // 기록 대기는 기록 탭과 같은 목록에서 가져온다. 두 화면이 다른 기준으로 고르면
  // 홈에서 재촉한 하루가 기록 탭에는 없는 상황이 생긴다.
  const feed = useDiaryFeed({ includePending: true });
  const pendingRecord = useMemo(
    () =>
      feed.data?.pages
        .flatMap((page) => page.records)
        .find((record) => record.phase === 'record_pending') ?? null,
    [feed.data],
  );

  const focus = useMemo(
    () => resolveFocus(schedules.data ?? [], pendingRecord),
    [schedules.data, pendingRecord],
  );

  if (schedules.isLoading) return <LoadingScreen message="하루를 준비하고 있어요." />;
  if (schedules.isError) {
    return (
      <ErrorState
        message={getApiError(schedules.error).message}
        onRetry={() => schedules.refetch()}
      />
    );
  }

  const openSchedule = (scheduleId: number) =>
    router.push({ pathname: '/schedules/[id]', params: { id: scheduleId } });

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{dateFormatter.format(new Date())}</Text>
          <Text style={styles.title}>{user?.nickname}님의 하루</Text>
        </View>

        {focus.kind === 'today' ? (
          <TodayCard schedule={focus.schedule} onOpen={() => openSchedule(focus.schedule.id)} />
        ) : null}

        {focus.kind === 'record' ? (
          <RecordPromptCard
            record={focus.record}
            onOpen={() => openSchedule(focus.record.scheduleId)}
          />
        ) : null}

        {focus.kind === 'upcoming' ? (
          <UpcomingCard schedule={focus.schedule} onOpen={() => openSchedule(focus.schedule.id)} />
        ) : null}

        {focus.kind === 'empty' ? (
          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>아직 계획이 없어요</Text>
            <Text style={styles.cardTitle}>어떤 하루를{'\n'}보내고 싶으세요?</Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/schedules/new',
                  params: { date: seoulDateKey(new Date().toISOString()) },
                })
              }
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>새로운 하루 계획하기</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/records')} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>지난 기록 다시 보기</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 오늘의 하루. 시작 전이면 시작 시각을, 진행 중이면 다음 장소를 앞세운다. */
function TodayCard({ schedule, onOpen }: { schedule: ScheduleView; onOpen: () => void }) {
  // Date.now() 대신 new Date()를 쓴다. React Compiler가 Date.now()를 렌더 중 부르면
  // 안 되는 순수하지 않은 호출로 잡는다.
  const started = new Date(schedule.start_at) <= new Date();
  const visited = schedule.places.filter((place) => place.visited).length;
  const nextPlace = schedule.places.find((place) => !place.visited) ?? null;

  return (
    <View style={[styles.card, styles.cardToday]}>
      <Text style={[styles.cardEyebrow, styles.onDark]}>
        {started ? '지금 진행 중' : `${timeFormatter.format(new Date(schedule.start_at))} 시작`}
        {' · '}
        {schedule.space_name}
      </Text>
      <Text style={[styles.cardTitle, styles.titleOnDark]}>{schedule.title}</Text>

      {started && nextPlace ? (
        <Text style={[styles.cardLine, styles.lineOnDark]}>
          다음 장소 <Text style={styles.strong}>{nextPlace.name}</Text>
        </Text>
      ) : schedule.places.length > 0 ? (
        <Text style={[styles.cardLine, styles.lineOnDark]}>
          ⌖ {schedule.places.map((place) => place.name).join(' → ')}
        </Text>
      ) : null}

      {schedule.place_count > 0 ? (
        <Text style={[styles.cardMeta, styles.lineOnDark]}>
          {visited} / {schedule.place_count}곳 방문
        </Text>
      ) : null}

      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>{started ? '다음 장소 보기' : '오늘의 하루 보기'}</Text>
      </Pressable>
    </View>
  );
}

/** 다녀왔는데 아직 남기지 않은 하루. 홈이 기록을 유도하는 자리다. */
function RecordPromptCard({ record, onOpen }: { record: RecordView; onOpen: () => void }) {
  return (
    <View style={[styles.card, styles.cardRecord]}>
      <Text style={styles.cardEyebrow}>{record.dateLabel} · 아직 남기지 않았어요</Text>
      <Text style={styles.cardTitle}>{record.title}</Text>
      {record.placeCount > 0 ? (
        <Text style={styles.cardLine}>⌖ {record.placeCount}곳을 다녀왔어요</Text>
      ) : null}
      <Text style={styles.cardMeta}>사진 한 장만 올려도 이 하루는 기억으로 남습니다.</Text>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>오늘을 남기기</Text>
      </Pressable>
    </View>
  );
}

/** 다음 약속. 오늘은 비었지만 앞으로 잡힌 하루가 있을 때 보여준다. */
function UpcomingCard({ schedule, onOpen }: { schedule: ScheduleView; onOpen: () => void }) {
  const noPlaces = schedule.place_count === 0;

  return (
    <View style={styles.card}>
      <Text style={styles.cardEyebrow}>
        {dateFormatter.format(new Date(schedule.start_at))} · {schedule.space_name}
      </Text>
      <Text style={styles.cardTitle}>{schedule.title}</Text>
      {schedule.places.length > 0 ? (
        <Text style={styles.cardLine}>
          ⌖ {schedule.places.map((place) => place.name).join(' → ')}
        </Text>
      ) : null}
      {noPlaces ? <Text style={styles.cardMeta}>아직 갈 곳을 정하지 않았어요.</Text> : null}
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>{noPlaces ? '갈 곳 정하기' : '하루 보기'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  heading: { gap: 6 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  title: { color: colors.text, fontSize: 25, fontWeight: '800' },

  // 홈은 여러 정보를 나열하지 않고 지금 할 일 하나만 크게 보여준다. 그래서 카드가
  // 하나뿐이고, 그 안의 주요 행동 버튼도 하나다.
  card: { alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: spacing.sm, marginTop: spacing.xl, padding: spacing.lg },
  // 오늘의 하루는 어두운 바탕으로 두어 먼저 눈에 들어오게 한다.
  cardToday: { backgroundColor: colors.text, borderColor: colors.text },
  cardRecord: { backgroundColor: colors.primarySoft, borderColor: colors.primary },

  cardEyebrow: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  cardTitle: { color: colors.text, fontSize: 25, fontWeight: '800', lineHeight: 33 },
  cardLine: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  cardMeta: { color: colors.muted, fontSize: 12 },
  strong: { color: colors.text, fontWeight: '700' },

  onDark: { color: colors.primarySoft },
  titleOnDark: { color: '#FFFFFF' },
  lineOnDark: { color: '#DFD8D3' },

  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 14, justifyContent: 'center', marginTop: spacing.sm, minHeight: 50, paddingHorizontal: spacing.xl },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: { justifyContent: 'center', minHeight: 44 },
  secondaryText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
