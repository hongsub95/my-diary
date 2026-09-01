import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/shared/theme';

const memories = [
  { date: '8월 27일 · 우리 둘의 하루', title: '한강 피크닉', note: '노을이 생각보다 오래 남아 있어서 천천히 걸었다.', tone: '#A86965', places: '여의나루 · 한강공원' },
  { date: '8월 16일 · 나의 하루', title: '북촌 기록 산책', note: '골목을 따라 걷다가 작은 전시를 만났다.', tone: '#7A6C61', places: '북촌 · 안국' },
  { date: '8월 2일 · 여름 여행', title: '친구들과 강릉', note: '바다보다 오래 기억날 커피 한 잔.', tone: '#66808B', places: '안목해변 · 초당' },
];

export default function RecordsScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>MY DAYBOOK</Text>
        <Text style={styles.title}>우리가 보낸{"\n"}하루들</Text>
        <Text style={styles.description}>날짜보다 장면으로 먼저 기억해 보세요.</Text>

        <Pressable style={styles.featured}>
          <View style={styles.photoGrid}>
            <MemoryPhoto color={memories[0].tone} style={styles.bigPhoto} />
            <MemoryPhoto color="#78886A" />
            <MemoryPhoto color="#748994" />
          </View>
          <View style={styles.featuredCopy}>
            <Text style={styles.date}>{memories[0].date}</Text>
            <Text style={styles.featuredTitle}>{memories[0].title}</Text>
            <Text style={styles.quote}>“{memories[0].note}”</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>⌖ {memories[0].places}</Text>
              <Text style={styles.meta}>▣ 8</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.list}>
          {memories.slice(1).map((memory) => (
            <Pressable key={memory.title} style={styles.card}>
              <MemoryPhoto color={memory.tone} style={styles.thumbnail} />
              <View style={styles.cardCopy}>
                <Text style={styles.date}>{memory.date}</Text>
                <Text style={styles.cardTitle}>{memory.title}</Text>
                <Text numberOfLines={1} style={styles.cardNote}>{memory.note}</Text>
                <Text style={styles.meta}>⌖ {memory.places}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.apiNotice}>
          <Text style={styles.apiNoticeTitle}>기록 API 연결 예정</Text>
          <Text style={styles.apiNoticeText}>현재 화면은 정보 구조 확인용 데이터입니다. 백엔드의 기록 목록 API가 준비되면 사진과 장소 기록으로 교체됩니다.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MemoryPhoto({ color, style }: { color: string; style?: object }) {
  return (
    <View style={[styles.photo, { backgroundColor: color }, style]}>
      <View style={styles.sun} />
      <View style={styles.land} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  eyebrow: { color: colors.primaryDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: 'serif', fontSize: 34, fontWeight: '800', lineHeight: 42, marginTop: 8 },
  description: { color: colors.muted, fontSize: 13, marginBottom: 22, marginTop: 7 },
  featured: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 25, borderWidth: 1, overflow: 'hidden' },
  photoGrid: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', height: 255, gap: 3 },
  photo: { height: 126, overflow: 'hidden', position: 'relative', width: '39%' },
  bigPhoto: { height: 255, width: '60%' },
  sun: { backgroundColor: '#F3D6AA', borderRadius: 18, height: 36, opacity: 0.8, position: 'absolute', right: 18, top: 20, width: 36 },
  land: { backgroundColor: '#3D5042', borderRadius: 100, bottom: -50, height: 130, opacity: 0.55, position: 'absolute', right: -25, transform: [{ rotate: '-8deg' }], width: 180 },
  featuredCopy: { padding: 18 },
  date: { color: colors.muted, fontSize: 10 },
  featuredTitle: { color: colors.text, fontFamily: 'serif', fontSize: 24, fontWeight: '800', marginTop: 5 },
  quote: { color: '#504945', fontFamily: 'serif', fontSize: 14, lineHeight: 22, marginVertical: 13 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: colors.muted, fontSize: 10, marginTop: 8 },
  list: { gap: 12, marginTop: 14 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 19, borderWidth: 1, flexDirection: 'row', padding: 10 },
  thumbnail: { borderRadius: 13, height: 96, width: 92 },
  cardCopy: { flex: 1, justifyContent: 'center', marginLeft: 13 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 4 },
  cardNote: { color: colors.muted, fontSize: 11, marginTop: 5 },
  apiNotice: { backgroundColor: colors.sand, borderRadius: 17, marginTop: 18, padding: 15 },
  apiNoticeTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
  apiNoticeText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 5 },
});
