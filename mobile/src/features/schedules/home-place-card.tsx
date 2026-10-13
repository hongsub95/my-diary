import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import type { ScheduleView } from './schedule-adapter';
import { homePlaceFocus } from './home-place-model';

export function HomePlaceCard({ schedule, selectedPlaceId, onOpen }: {
  schedule: ScheduleView;
  selectedPlaceId?: number;
  onOpen: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme();
  const { places, place, label, visitedCount, ordinal } = homePlaceFocus(schedule, selectedPlaceId);
  const cover = schedule.record_summary.cover_thumbnail_url;
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const time = place?.plannedTime?.slice(0, 5);

  return (
    <View style={styles.root}>
      <View style={styles.placeRow}>
        {cover && failedCover !== cover ? (
          <Image
            source={{ uri: cover }}
            accessibilityLabel="이 하루의 대표 사진"
            style={styles.thumbnail}
            onError={() => setFailedCover(cover)}
          />
        ) : (
          <View style={styles.placeholder} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <SymbolView
              name={{ ios: 'mappin.and.ellipse', android: 'location_on', web: 'location_on' }}
              size={32}
              tintColor={palette.primaryDark}
              fallback={<Text style={styles.placeholderNumber}>{ordinal || '＋'}</Text>}
            />
          </View>
        )}
        <View style={styles.placeBody}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{place ? label : '갈 곳 정하기'}</Text>
          </View>
          <Text numberOfLines={2} style={styles.placeName}>{place?.name ?? '아직 장소가 없어요'}</Text>
          <Text style={styles.placeMeta}>
            {place ? `${place.visited ? '방문 완료' : time ? `${time} 예정` : '예정 시각 미정'} · ${ordinal}번째 장소` : '하루에 담을 첫 장소를 정해 보세요.'}
          </Text>
          {places.length > 0 ? (
            <View style={styles.progress} accessibilityLabel={`${places.length}곳 중 ${visitedCount}곳 방문`}>
              <Text style={styles.progressText}>{visitedCount} / {places.length}곳 방문</Text>
              <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {places.slice(0, 5).map(item => (
                  <View key={item.id} style={[styles.dot, item.visited && styles.visitedDot]} />
                ))}
                {places.length > 5 ? <Text style={styles.moreDots}>+{places.length - 5}</Text> : null}
              </View>
            </View>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${schedule.title}, 하루 상세 보기`}
        onPress={onOpen}
        style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}>
        <Text style={styles.openButtonText}>하루 상세 보기</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  root: { gap: 16, paddingBottom: 18 },
  placeRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  thumbnail: { backgroundColor: colors.surfaceMuted, borderRadius: radii.full, height: 76, width: 76 },
  placeholder: { alignItems: 'center', backgroundColor: palette.primarySoft, borderRadius: radii.full, height: 76, justifyContent: 'center', width: 76 },
  placeholderNumber: { color: palette.primaryDark, fontSize: 30, fontWeight: '700' },
  placeBody: { flex: 1, gap: 4 },
  badge: { alignSelf: 'flex-start', backgroundColor: palette.primarySoft, borderRadius: radii.full, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { color: palette.primaryDark, fontSize: 11, fontWeight: '600' },
  placeName: { color: colors.text, fontSize: 21, fontWeight: '700', letterSpacing: -0.5 },
  placeMeta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  progress: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  progressText: { color: colors.muted, fontSize: 12 },
  dots: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  dot: { borderColor: colors.muted, borderRadius: radii.full, borderWidth: 1, height: 8, width: 8 },
  visitedDot: { backgroundColor: palette.primary, borderColor: palette.primary },
  moreDots: { color: colors.muted, fontSize: 10 },
  openButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: radii.card, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16, paddingVertical: 12 },
  openButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});
