import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { PhaseTag, phaseKind, phaseLabel } from '@/features/schedules/phase-tag';
import type { ScheduleView } from '@/features/schedules/schedule-adapter';
import { useSchedules } from '@/features/schedules/schedule-queries';
import { EmptyState } from '@/shared/components/empty-state';
import { colors, radii, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { seoulDateKey } from '@/shared/utils/date';

// 캘린더에서 하루 하나를 펼쳐 보는 상태별 요약 카드 (CALENDAR_SCREEN_SPEC 2026-10-15, 시안 C·E).
// 일간 보기와 월간 날짜 패널이 같은 카드를 쓴다.

const DAY_MS = 24 * 60 * 60 * 1000;
// 카드에 다 늘어놓으면 하루 하나가 화면을 넘는다. 나머지는 개수로만 알리고 상세에서 본다.
const MAX_PLACES = 5;

/** 'YYYY-MM-DD'가 오늘(서비스 시간대)에서 며칠 떨어졌는지. 미래는 양수, 과거는 음수다. */
function daysFromToday(key: string) {
  const toUtc = (value: string) => Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
  return Math.round((toUtc(key) - toUtc(seoulDateKey(new Date().toISOString()))) / DAY_MS);
}

/** 서비스 시간대 기준 `HH:MM`. 24시간제로 써서 시작·종료를 한 줄에 짧게 놓는다. */
function seoulTime(utcIsoString: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(utcIsoString));
}

/**
 * 카드 둘째 줄의 시간 문구. 당일이면 시각 범위, 여러 날짜면 날짜 범위를 보여 준다.
 *
 * @param schedule 일정
 * @returns 예: `12:00 – 15:00`, `10월 10일 ~ 11일`, `10월 31일 ~ 11월 1일`
 */
function timeRange(schedule: ScheduleView) {
  const start = seoulDateKey(schedule.start_at);
  const end = seoulDateKey(schedule.end_at);
  if (start === end) return `${seoulTime(schedule.start_at)} – ${seoulTime(schedule.end_at)}`;
  const [startMonth, startDay] = [Number(start.slice(5, 7)), Number(start.slice(8))];
  const [endMonth, endDay] = [Number(end.slice(5, 7)), Number(end.slice(8))];
  return `${startMonth}월 ${startDay}일 ~ ${startMonth === endMonth ? '' : `${endMonth}월 `}${endDay}일`;
}

/**
 * 배지 문구. 상태 이름에 "언제인지"를 붙여 카드만 보고도 시점을 알게 한다.
 * 예정은 시작일을, 남기기 전은 끝난 날을 기준으로 센다.
 *
 * @param schedule 일정
 * @returns 예: `예정 · 2일 뒤`, `어제 · 남기기 전`, `남긴 하루`
 */
function badgeLabel(schedule: ScheduleView) {
  const phase = schedule.experience_phase;
  if (phase === 'upcoming') {
    const days = daysFromToday(seoulDateKey(schedule.start_at));
    return `예정 · ${days === 1 ? '내일' : `${days}일 뒤`}`;
  }
  if (phase === 'record_pending') {
    const days = -daysFromToday(seoulDateKey(schedule.end_at));
    return `${days <= 0 ? '오늘' : days === 1 ? '어제' : `${days}일 전`} · 남기기 전`;
  }
  return phaseLabel(phase);
}

/**
 * 하루 하나의 상태별 요약 카드.
 *
 * - 예정·오늘: 갈 곳 순서를 먼저 보여 준다. 장소가 없으면 갈 곳 정하기로 보낸다.
 * - 남기기 전: 다녀온 곳 체크와 기록 버튼 하나.
 * - 남긴 하루: 대표 사진 → 일기 한 줄 → 장소 요약.
 *
 * 글 작성자 목록은 함께한 사람과 다르므로 보여 주지 않는다(UX_INFORMATION_ARCHITECTURE_SPEC 11절).
 *
 * @param schedule include=places로 받은 일정. 장소를 받지 않았으면 장소 줄이 비어 보인다
 */
export function DaySummaryCard({ schedule }: { schedule: ScheduleView }) {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const kind = phaseKind(schedule.experience_phase);
  const summary = schedule.record_summary;
  const places = [...schedule.places].sort((a, b) => a.sortOrder - b.sortOrder);
  const shown = places.slice(0, MAX_PLACES);
  const visited = places.filter(place => place.visited).length;
  const openDetail = (tab?: 'record') => router.push({ pathname: '/schedules/[id]', params: tab ? { id: schedule.id, tab } : { id: schedule.id } });

  const header = <>
    <View style={styles.badgeRow}><PhaseTag size="badge" kind={kind} label={badgeLabel(schedule)} /></View>
    <Text style={styles.title}>{schedule.title}</Text>
    <Text style={styles.meta}>{timeRange(schedule)} · {schedule.space_name}</Text>
  </>;
  const moreLink = (label: string, tab?: 'record') => <Pressable accessibilityRole="link" onPress={() => openDetail(tab)} style={styles.link}>
    <Text style={styles.linkText}>{label}</Text><Text style={styles.linkText}>›</Text>
  </Pressable>;
  const rest = places.length > shown.length && <Text style={styles.rest}>외 {places.length - shown.length}곳</Text>;

  if (kind === 'done') {
    return <View style={styles.card}>
      {summary.cover_thumbnail_url && <View style={styles.cover}>
        <Image source={{ uri: summary.cover_thumbnail_url }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
        {summary.photo_count > 0 && <Text style={styles.photoCount}>사진 {summary.photo_count}장</Text>}
      </View>}
      {header}
      {summary.diary_excerpt && <Text style={styles.quote} numberOfLines={3}>{summary.diary_excerpt}</Text>}
      {places.length > 0 && <Text style={styles.placeLine} numberOfLines={2}>
        <Text style={styles.placeLineStrong}>장소 {places.length}곳</Text> · {places.map(place => place.name).join(' · ')}
      </Text>}
      {moreLink('기록 보기')}
    </View>;
  }

  if (kind === 'pending') {
    return <View style={styles.card}>
      {header}
      {places.length > 0 && <>
        <View style={styles.section}><Text style={styles.sectionLabel}>다녀온 곳</Text><Text style={styles.sectionValue}>{visited} / {places.length}</Text></View>
        <View style={styles.flow}>
          {shown.map((place, index) => <View key={place.id} style={styles.stop} accessibilityLabel={`${place.name}, ${place.visited ? '다녀옴' : '안 감'}`}>
            <View style={[styles.num, place.visited ? styles.numVisited : styles.numSkipped]}>
              <Text style={[styles.numText, !place.visited && styles.numSkippedText]}>{place.visited ? '✓' : index + 1}</Text>
            </View>
            <Text style={[styles.placeName, !place.visited && styles.placeSkipped]} numberOfLines={1}>{place.name}</Text>
          </View>)}
        </View>
        {rest}
      </>}
      {/* 이 카드의 주요 행동은 하나다. 상세의 사진·기록 탭으로 바로 연다. */}
      <Pressable accessibilityRole="button" onPress={() => openDetail('record')} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
        <Text style={styles.ctaText}>이 하루 남기기</Text>
      </Pressable>
      <Text style={styles.ctaNote}>사진 한 장만 올려도 기록이 돼요</Text>
      {moreLink('하루 자세히 보기')}
    </View>;
  }

  return <View style={styles.card}>
    {header}
    {places.length > 0 ? <>
      <View style={styles.section}><Text style={styles.sectionLabel}>갈 곳</Text><Text style={styles.sectionValue}>{places.length}곳</Text></View>
      <View style={styles.flow}>
        {shown.map((place, index) => <View key={place.id} style={styles.stop}>
          <View style={styles.num}><Text style={styles.numText}>{index + 1}</Text></View>
          <View style={styles.placeText}>
            <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
            {place.address && <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>}
          </View>
        </View>)}
      </View>
      {rest}
    </> : <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/schedules/[id]/plan', params: { id: schedule.id } })} style={styles.section}>
      <Text style={styles.sectionLabel}>아직 갈 곳이 없어요</Text><Text style={styles.linkText}>갈 곳 정하기 ›</Text>
    </Pressable>}
    {moreLink('하루 자세히 보기')}
  </View>;
}

/**
 * 하루 하나를 조회해 요약 카드로 늘어놓는다. 로딩·실패·빈 상태를 따로 보여 준다.
 *
 * 월간·주간이 쓰는 석 달치 조회에는 장소가 없다. 카드는 장소가 필요해서 그날 하루만
 * include=places로 따로 받는다(홈과 같은 조회라 캐시도 함께 쓴다). 여러 날짜 일정은
 * 날짜가 겹치기만 하면 서버가 넣어 준다.
 *
 * @param day 'YYYY-MM-DD'
 */
export function DayAgenda({ day }: { day: string }) {
  const styles = useThemedStyles(createStyles);
  const query = useSchedules({ from: day, to: day, includePlaces: true });

  if (query.isLoading) return <Text accessibilityLiveRegion="polite" style={styles.state}>하루를 불러오는 중…</Text>;
  // 실패를 빈 하루로 보이지 않게 한다. 실제로 하루가 있는데 "없어요"라고 하면 안 된다.
  if (query.isError) return <Pressable accessibilityRole="button" onPress={() => { void query.refetch(); }}>
    <Text style={styles.state}>하루를 불러오지 못했어요. 다시 시도</Text>
  </Pressable>;
  const items = [...(query.data ?? [])].sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id - b.id);
  if (!items.length) return <EmptyState compact icon="📅" title="이날은 예정된 하루가 없어요" description="다른 날짜를 골라 보세요." />;
  return <View style={styles.list}>{items.map(item => <DaySummaryCard key={item.id} schedule={item} />)}</View>;
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  list: { gap: spacing.md },
  state: { color: colors.muted, fontSize: 14, paddingVertical: spacing.lg, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, padding: 16 },
  badgeRow: { flexDirection: 'row' },
  title: { color: colors.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.4, marginTop: 10 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 4 },
  section: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, minHeight: 24 },
  sectionLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  sectionValue: { color: colors.text, fontSize: 12, fontWeight: '600' },
  flow: { marginTop: 4 },
  stop: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 46 },
  num: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 12, height: 24, justifyContent: 'center', width: 24 },
  numText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  numVisited: { backgroundColor: colors.sage },
  numSkipped: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 2 },
  numSkippedText: { color: colors.muted },
  placeText: { flex: 1 },
  placeName: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '600' },
  placeSkipped: { color: colors.muted, fontWeight: '400' },
  placeAddress: { color: colors.muted, fontSize: 12, marginTop: 1 },
  rest: { color: colors.muted, fontSize: 12, marginLeft: 36 },
  link: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, minHeight: 44, paddingTop: 12 },
  linkText: { color: palette.primaryDark, fontSize: 14, fontWeight: '600' },
  cta: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: radii.md, justifyContent: 'center', marginTop: 16, minHeight: 52 },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  ctaNote: { color: colors.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },
  pressed: { opacity: 0.85 },
  cover: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, height: 180, marginBottom: 14, overflow: 'hidden' },
  photoCount: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, bottom: 10, color: '#FFFFFF', fontSize: 12, fontWeight: '600', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 3, position: 'absolute', right: 10 },
  quote: { borderLeftColor: palette.primarySoft, borderLeftWidth: 3, color: colors.text, fontSize: 15, lineHeight: 24, marginTop: 12, paddingLeft: 12 },
  placeLine: { color: colors.muted, fontSize: 13, marginTop: 12 },
  placeLineStrong: { color: colors.text, fontWeight: '600' },
});
