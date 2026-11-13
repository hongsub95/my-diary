import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { IconBadge } from '@/features/menus/icon-badge';
import { getApiError } from '@/shared/api/api-error';
import type { SeasonalBackgroundTime } from '@/shared/api/types';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
import { TIME_MODE_DESCRIPTIONS, TIME_MODE_LABELS, TIME_MODES } from './season-rules';
import { useSeasonal } from './seasonal-context';

type SeasonalSettingsRowsProps = {
  /** 저장에 실패했을 때 안내를 띄운다. 더보기 화면의 스낵바를 넘긴다. */
  onError: (message: string) => void;
};

/**
 * 더보기 › 나에게 맞추기 안의 "크리스마스 배경" 스위치와 "사용자 설정"(자동·낮·밤) 줄.
 *
 * 기간 밖이면 두 줄 모두 숨긴다. 끌 수 없는 배경의 스위치가 남아 있으면 무엇을 끄는지
 * 알 수 없다. 배경을 끄면 "사용자 설정" 줄만 숨긴다 — 낮·밤은 배경이 보일 때만 뜻이 있다.
 *
 * 고르는 즉시 화면에 적용하고, 저장에 실패하면 되돌린 뒤 안내한다 (테마 화면과 같다).
 * 위·아래 구분선은 부모 카드가 그리지 않으므로 여기서 앞쪽 구분선을 함께 그린다.
 */
export function SeasonalSettingsRows({ onError }: SeasonalSettingsRowsProps) {
  const palette = useTheme();
  const styles = useThemedStyles(createStyles);
  const { inSeason, enabled, timeMode, setEnabled, setTimeMode } = useSeasonal();

  if (!inSeason) return null;

  async function toggle(value: boolean) {
    try {
      await setEnabled(value);
    } catch (caught) {
      onError(getApiError(caught).message);
    }
  }

  async function choose(mode: SeasonalBackgroundTime) {
    if (mode === timeMode) return;
    try {
      await setTimeMode(mode);
    } catch (caught) {
      onError(getApiError(caught).message);
    }
  }

  return (
    <>
      <View style={styles.divider} />
      <View style={styles.row}>
        <IconBadge name="seasonal" compact />
        <View style={styles.copy}>
          <View style={styles.labelLine}>
            <Text style={styles.label}>크리스마스 배경</Text>
            <Text style={styles.limited}>기간 한정</Text>
          </View>
          <Text style={styles.description}>12월 26일까지만 보여요</Text>
        </View>
        <Switch
          accessibilityLabel="크리스마스 배경"
          onValueChange={value => { void toggle(value); }}
          thumbColor={colors.surface}
          trackColor={{ false: colors.sand, true: palette.primary }}
          value={enabled}
        />
      </View>

      {enabled && (
        <>
          <View style={styles.divider} />
          <View style={styles.modeRow}>
            <View style={styles.modeLine}>
              <IconBadge name="seasonal-time" compact />
              <Text style={styles.label}>사용자 설정</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel="사용자 설정" style={styles.segment}>
                {TIME_MODES.map(mode => {
                  const selected = mode === timeMode;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={mode}
                      onPress={() => { void choose(mode); }}
                      style={[styles.segmentItem, selected && styles.segmentItemSelected]}>
                      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{TIME_MODE_LABELS[mode]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Text style={styles.modeDescription}>{TIME_MODE_DESCRIPTIONS[timeMode]}</Text>
          </View>
        </>
      )}
    </>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  divider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginLeft: 40 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 64, paddingVertical: spacing.sm },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  labelLine: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  label: { color: colors.text, fontSize: typography.body, fontWeight: typography.regular },
  limited: { backgroundColor: palette.primarySoft, borderRadius: 6, color: palette.primaryDark, fontSize: 10.5, fontWeight: typography.semibold, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 1 },
  description: { color: colors.muted, fontSize: 12 },
  modeRow: { gap: 6, paddingVertical: spacing.sm },
  modeLine: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 44 },
  segment: { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, flexDirection: 'row', gap: 2, marginLeft: 'auto', padding: 3 },
  // 누르기 쉬운 크기(높이 36 이상)를 지키면서 세 칸이 한 줄에 들어가게 좁게 잡는다.
  segmentItem: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: 36, minWidth: 44, paddingHorizontal: spacing.sm },
  segmentItemSelected: { backgroundColor: colors.surface, elevation: 1, shadowColor: colors.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: typography.semibold },
  segmentTextSelected: { color: palette.primaryDark },
  modeDescription: { color: colors.muted, fontSize: 12, paddingLeft: 40 },
});
