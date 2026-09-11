import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-context';
import type { SchedulePlaceView } from '@/features/schedules/schedule-adapter';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { useDiary } from './diary-queries';
import { pickPhotos } from './photo-picker';

const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * 화면에서 고른 시각을 서버가 받는 UTC ISO 문자열로 바꾼다.
 *
 * @param dateKey 일정 날짜 YYYY-MM-DD
 * @param timeText HH:MM
 *
 * 한국 시간으로 고정해 변환한다. 기기 시간대에 맡기면 해외에 있거나 시계가 어긋난
 * 사용자의 기록이 엉뚱한 시각에 남는다.
 */
function toUtcIso(dateKey: string, timeText: string): string {
  return new Date(`${dateKey}T${timeText}:00+09:00`).toISOString();
}

/**
 * 일정 상세의 일기 영역. 하루의 사진·본문·방문 타임라인을 함께 다룬다.
 *
 * 사진을 본문보다 위에 두는 이유: 완료한 하루는 사진과 기록이 먼저 보여야 한다는
 * 요구사항(docs/UX_IDENTITY_REDIRECTION_SPEC.md 7절)을 따른 것이다.
 * 웹의 frontend/src/features/diaries/DiarySection.jsx와 같은 구성이다.
 */
export function DiarySection({
  scheduleId,
  dateKey,
  places,
}: {
  scheduleId: number;
  dateKey: string;
  places: SchedulePlaceView[];
}) {
  const { user } = useAuth();
  const styles = useThemedStyles(createStyles);
  const {
    entries,
    photos,
    timeline,
    saveEntry,
    removeEntry,
    addPhotos,
    removePhoto,
    addTimeline,
    removeTimeline,
  } = useDiary(scheduleId);

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [addingItem, setAddingItem] = useState(false);
  const [itemTime, setItemTime] = useState('12:00');
  const [itemTitle, setItemTitle] = useState('');
  const [itemPlaceId, setItemPlaceId] = useState<number | null>(null);

  const allEntries = entries.data ?? [];
  // 단수 경로가 없어도 내 글은 작성자 id로 가려낼 수 있다. 남의 글은 읽기만 한다.
  const myEntry = allEntries.find((entry) => entry.author.id === user?.id) ?? null;
  const otherEntries = allEntries.filter((entry) => entry.author.id !== user?.id);

  async function handlePickPhotos() {
    setError(null);
    const picked = await pickPhotos();
    if (picked.length === 0) return;
    try {
      await addPhotos.mutateAsync(picked);
    } catch (caught) {
      setError(getApiError(caught).message);
    }
  }

  async function handleRemovePhoto(photoId: number) {
    setError(null);
    try {
      await removePhoto.mutateAsync(photoId);
    } catch (caught) {
      // 남이 올린 사진은 서버가 막는다. 조용히 넘어가면 왜 안 지워지는지 알 수 없다.
      setError(getApiError(caught).message);
    }
  }

  function openEditor() {
    setContent(myEntry?.content ?? '');
    setMood(myEntry?.mood ?? '');
    setEditing(true);
  }

  async function handleSaveEntry() {
    if (!content.trim()) return setError('오늘을 한 문장으로라도 남겨보세요.');
    setError(null);
    try {
      await saveEntry.mutateAsync({ content: content.trim(), mood: mood.trim() || null });
      setEditing(false);
    } catch (caught) {
      setError(getApiError(caught).message);
    }
  }

  async function handleAddTimeline() {
    if (!itemTitle.trim()) return setError('무엇을 했는지 입력해 주세요.');
    setError(null);
    try {
      await addTimeline.mutateAsync({
        occurredAt: toUtcIso(dateKey, itemTime),
        title: itemTitle.trim(),
        memo: null,
        schedulePlaceId: itemPlaceId,
      });
      setItemTitle('');
      setItemPlaceId(null);
      setAddingItem(false);
    } catch (caught) {
      setError(getApiError(caught).message);
    }
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* 사진 */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>사진</Text>
          <Pressable onPress={handlePickPhotos} disabled={addPhotos.isPending}>
            <Text style={styles.action}>{addPhotos.isPending ? '올리는 중…' : '+ 추가'}</Text>
          </Pressable>
        </View>

        {photos.data && photos.data.length > 0 ? (
          <View style={styles.photoGrid}>
            {photos.data.map((photo) => (
              <Pressable
                key={photo.id}
                onLongPress={() => handleRemovePhoto(photo.id)}
                style={styles.photoBox}>
                {/* 썸네일이 없으면 서버가 원본 URL을 담아 준다. 화면은 한 값만 본다. */}
                <Image source={{ uri: photo.thumbnail_url ?? photo.file_url }} style={styles.photo} />
                {photo.is_cover ? <Text style={styles.coverBadge}>대표</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>사진 한 장만 올려도 이 하루는 기록이 됩니다.</Text>
        )}
        {photos.data && photos.data.length > 0 ? (
          <Text style={styles.hint}>사진을 길게 누르면 지웁니다.</Text>
        ) : null}
      </View>

      {/* 본문 */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>일기</Text>
          {myEntry && !editing ? (
            <Pressable onPress={openEditor}>
              <Text style={styles.action}>수정</Text>
            </Pressable>
          ) : null}
        </View>

        {editing ? (
          <View style={styles.editor}>
            <TextInput
              value={content}
              onChangeText={setContent}
              multiline
              placeholder="오늘 하루는 어땠나요?"
              placeholderTextColor={colors.muted}
              style={styles.contentInput}
            />
            <TextInput
              value={mood}
              onChangeText={setMood}
              maxLength={20}
              placeholder="오늘의 기분 (선택)"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <View style={styles.editorActions}>
              <Pressable onPress={() => setEditing(false)} style={styles.ghostButton}>
                <Text style={styles.ghostText}>취소</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEntry}
                disabled={saveEntry.isPending}
                style={styles.primaryButton}>
                <Text style={styles.primaryText}>{saveEntry.isPending ? '저장 중…' : '저장'}</Text>
              </Pressable>
            </View>
          </View>
        ) : myEntry ? (
          <View style={styles.entry}>
            {myEntry.mood ? <Text style={styles.mood}>{myEntry.mood}</Text> : null}
            <Text style={styles.entryContent}>{myEntry.content}</Text>
            <Pressable onPress={() => removeEntry.mutate()} disabled={removeEntry.isPending}>
              <Text style={styles.removeText}>지우기</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.prompt}>
            <Text style={styles.empty}>아직 남긴 글이 없어요.</Text>
            <Pressable onPress={openEditor} style={styles.primaryButton}>
              <Text style={styles.primaryText}>오늘을 남기기</Text>
            </Pressable>
          </View>
        )}

        {/* 같은 하루를 함께 보낸 사람의 글. 읽기만 한다. */}
        {otherEntries.map((entry) => (
          <View key={entry.id} style={styles.entry}>
            <Text style={styles.author}>{entry.author.nickname}</Text>
            {entry.mood ? <Text style={styles.mood}>{entry.mood}</Text> : null}
            <Text style={styles.entryContent}>{entry.content}</Text>
          </View>
        ))}
      </View>

      {/* 방문 기록 */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>방문 기록</Text>
          {!addingItem ? (
            <Pressable onPress={() => setAddingItem(true)}>
              <Text style={styles.action}>+ 추가</Text>
            </Pressable>
          ) : null}
        </View>

        {addingItem ? (
          <View style={styles.editor}>
            <View style={styles.timeRow}>
              <TextInput
                value={itemTime}
                onChangeText={setItemTime}
                placeholder="HH:MM"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.timeInput]}
              />
              <TextInput
                value={itemTitle}
                onChangeText={setItemTitle}
                placeholder="무엇을 했나요?"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.flexInput]}
              />
            </View>

            {places.length > 0 ? (
              <View style={styles.placeChips}>
                {/* 장소 연결은 선택이다. 계획에 없던 곳은 제목만으로 남길 수 있다. */}
                {places.map((place) => (
                  <Pressable
                    key={place.id}
                    onPress={() => setItemPlaceId(itemPlaceId === place.id ? null : place.id)}
                    style={[styles.chip, itemPlaceId === place.id && styles.chipOn]}>
                    <Text style={[styles.chipText, itemPlaceId === place.id && styles.chipTextOn]}>
                      {place.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.editorActions}>
              <Pressable onPress={() => setAddingItem(false)} style={styles.ghostButton}>
                <Text style={styles.ghostText}>취소</Text>
              </Pressable>
              <Pressable
                onPress={handleAddTimeline}
                disabled={addTimeline.isPending}
                style={styles.primaryButton}>
                <Text style={styles.primaryText}>
                  {addTimeline.isPending ? '남기는 중…' : '남기기'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {timeline.data && timeline.data.length > 0 ? (
          timeline.data.map((item) => (
            <Pressable
              key={item.id}
              onLongPress={() => removeTimeline.mutate(item.id)}
              style={styles.timelineItem}>
              <Text style={styles.timelineTime}>
                {timeFormatter.format(new Date(item.occurred_at))}
              </Text>
              <View style={styles.timelineBody}>
                <Text style={styles.timelineTitle}>{item.title}</Text>
                {item.place_name ? <Text style={styles.timelinePlace}>⌖ {item.place_name}</Text> : null}
              </View>
            </Pressable>
          ))
        ) : !addingItem ? (
          <Text style={styles.empty}>
            몇 시에 어디를 다녀왔는지 남겨두면 나중에 하루가 더 잘 떠올라요.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: { gap: spacing.lg },
  error: { color: colors.danger, fontSize: 12 },

  section: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
  sectionHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  action: { color: palette.primary, fontSize: 12, fontWeight: '700' },
  empty: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  hint: { color: colors.muted, fontSize: 10 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photoBox: { borderRadius: 12, height: 96, overflow: 'hidden', width: 96 },
  photo: { height: '100%', width: '100%' },
  coverBadge: { backgroundColor: palette.primary, borderRadius: 99, bottom: 5, color: '#FFFFFF', fontSize: 9, fontWeight: '800', left: 5, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, position: 'absolute' },

  prompt: { alignItems: 'flex-start', gap: spacing.sm },
  entry: { backgroundColor: colors.background, borderRadius: 14, gap: 4, marginTop: spacing.sm, padding: spacing.md },
  author: { color: palette.primary, fontSize: 11, fontWeight: '700' },
  mood: { fontSize: 15 },
  entryContent: { color: colors.text, fontSize: 14, lineHeight: 23 },
  removeText: { color: colors.muted, fontSize: 11, marginTop: 6, textDecorationLine: 'underline' },

  editor: { gap: spacing.sm },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, fontSize: 14, minHeight: 46, paddingHorizontal: spacing.md },
  contentInput: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, fontSize: 14, lineHeight: 23, minHeight: 110, padding: spacing.md, textAlignVertical: 'top' },
  editorActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  primaryButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 12, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  ghostButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 12, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg },
  ghostText: { color: colors.muted, fontSize: 14, fontWeight: '600' },

  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeInput: { width: 96 },
  flexInput: { flex: 1 },
  placeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderColor: colors.border, borderRadius: 99, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  chipText: { color: colors.muted, fontSize: 11 },
  chipTextOn: { color: palette.primary, fontWeight: '700' },

  timelineItem: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  timelineTime: { color: colors.muted, fontSize: 12, width: 46 },
  timelineBody: { flex: 1, gap: 2 },
  timelineTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  timelinePlace: { color: palette.primary, fontSize: 11 },
});
