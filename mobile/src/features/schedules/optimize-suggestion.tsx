import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OptimizationPreview } from '@/features/schedules/schedule-api';
import type { SchedulePlaceView } from '@/features/schedules/schedule-adapter';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { formatDistance } from '@/shared/utils/distance';

/**
 * 순서 다듬기 제안.
 *
 * @param places 지금 담긴 장소들. 제안에 담긴 id를 이름으로 바꾸는 데 쓴다
 * @param busy 다른 조작이 진행 중인지
 * @param onRequest 제안을 받아온다
 * @param onApply 받은 순서를 그대로 적용한다
 *
 * **받은 제안을 바로 적용하지 않는다.** 서버는 거리만 보기 때문에 "카페 → 저녁 → 술"
 * 처럼 순서에 뜻이 있는 하루를 뒤섞을 수 있다. 바뀐 순서를 눈으로 확인하고 사람이
 * 적용을 누르게 한다. 웹의 OptimizeSuggestion.jsx와 같은 규칙이다.
 */
export function OptimizeSuggestion({
  places,
  busy,
  onRequest,
  onApply,
}: {
  places: SchedulePlaceView[];
  busy: boolean;
  onRequest: () => Promise<OptimizationPreview>;
  onApply: (schedulePlaceIds: number[]) => Promise<unknown>;
}) {
  const styles = useThemedStyles(createStyles);
  const [preview, setPreview] = useState<OptimizationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (schedulePlaceId: number) =>
    places.find((place) => place.id === schedulePlaceId)?.name ?? '알 수 없는 장소';

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(getApiError(caught).message);
    }
  }

  // 두 곳 이하는 바꿀 것이 없다. 눌러도 "그대로가 좋아요"만 나오는 버튼을 두지 않는다.
  if (places.length < 3) return null;

  if (!preview) {
    return (
      <View style={styles.wrap}>
        <Pressable
          disabled={busy}
          onPress={() => run(async () => setPreview(await onRequest()))}
          style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
          <Text style={styles.triggerText}>{busy ? '살펴보는 중…' : '순서 다듬기'}</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  if (!preview.recommended) {
    return (
      <View style={styles.wrap}>
        <View style={styles.panel}>
          <Text style={styles.title}>지금 순서가 이미 괜찮아요</Text>
          <Text style={styles.note}>더 짧게 돌 방법을 찾지 못했어요.</Text>
          <Pressable onPress={() => setPreview(null)} style={styles.ghost}>
            <Text style={styles.ghostText}>닫기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <Text style={styles.title}>
          이렇게 돌면 {formatDistance(preview.saved_distance_m)} 짧아져요
        </Text>

        <View style={styles.order}>
          {preview.suggested.schedule_place_ids.map((placeId, index) => (
            <View key={placeId} style={styles.orderRow}>
              <Text style={styles.orderNumber}>{index + 1}</Text>
              <Text style={styles.orderName}>{nameOf(placeId)}</Text>
            </View>
          ))}
        </View>

        {/* 근거를 숨기지 않는다. 실제 도로 거리로 오해하면 "왜 이 순서지?" 싶을 때
            설명할 길이 없다. */}
        <Text style={styles.note}>
          직선거리로 계산한 제안이에요. 실제 길이나 이동 시간과는 다를 수 있어요.
          {preview.skipped_place_ids.length > 0 ? ' 주소가 없는 장소는 순서를 그대로 뒀어요.' : ''}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable onPress={() => setPreview(null)} style={[styles.button, styles.ghost]}>
            <Text style={styles.ghostText}>그대로 둘래요</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() =>
              run(async () => {
                await onApply(preview.suggested.schedule_place_ids);
                setPreview(null);
              })
            }
            style={({ pressed }) => [styles.button, styles.apply, pressed && styles.pressed]}>
            <Text style={styles.applyText}>{busy ? '바꾸는 중…' : '이 순서로 바꾸기'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  wrap: { gap: spacing.xs },

  // 목록 위에 얹히는 보조 동작이다. 채운 버튼으로 두면 "추가"나 "하루 마치기" 같은
  // 주된 행동과 무게가 같아 보여서, 테두리만 있는 형태로 한 단계 낮춘다.
  trigger: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    paddingVertical: 10,
  },
  triggerText: { color: colors.muted, fontSize: 13, fontWeight: '600' },

  // 제안은 아직 적용되지 않은 내용이다. 바탕을 달리해 아래 실제 목록과 섞이지 않게 한다.
  panel: { backgroundColor: palette.primarySoft, borderRadius: 12, gap: spacing.sm, padding: spacing.md },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },

  order: { gap: 4 },
  orderRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  // 아래 목록의 순번과 같은 자리를 차지해야 "이 장소가 몇 번째로 간다"가 한눈에 비교된다.
  orderNumber: {
    backgroundColor: palette.primary,
    borderRadius: 11,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    height: 22,
    lineHeight: 22,
    textAlign: 'center',
    width: 22,
  },
  orderName: { color: colors.text, flex: 1, fontSize: 13 },

  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 12 },

  actions: { flexDirection: 'row', gap: spacing.sm },
  button: { alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 10 },
  ghost: { alignItems: 'center', backgroundColor: colors.surface },
  ghostText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  apply: { backgroundColor: palette.primary },
  applyText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
