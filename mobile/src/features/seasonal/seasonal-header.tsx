import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-context';
import { getApiError } from '@/shared/api/api-error';
import type { SnackbarAction } from '@/shared/components/snackbar';
import { spacing, typography, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';
import { NIGHT_TEXT, NIGHT_TEXT_SHADOW } from './scene-colors';
import { useSeasonal } from './seasonal-context';

type SeasonalHeaderProps = {
  night: boolean;
  /** 화면의 스낵바. 끈 뒤 "되돌리기"와 저장 실패 안내를 띄운다 */
  onNotice: (message: string, action?: SnackbarAction) => void;
};

/**
 * 탭 머리말 위의 "{닉네임}님, 메리 크리스마스" 인사와 D-데이 칩.
 *
 * 칩의 ×는 더보기 스위치와 같은 설정을 끈다. 끄자마자 배경이 사라지므로 "되돌리기"를
 * 함께 준다 — 무심코 눌렀다가 더보기까지 찾아가 다시 켜게 하지 않으려는 것이다.
 */
export function SeasonalHeader({ night, onNotice }: SeasonalHeaderProps) {
  const { user } = useAuth();
  const { chipLabel, setEnabled } = useSeasonal();
  const styles = useThemedStyles(createStyles);
  const greeting = user?.nickname ? `${user.nickname}님, 메리 크리스마스` : '메리 크리스마스';

  async function turn(on: boolean) {
    try {
      await setEnabled(on);
      if (!on) {
        onNotice('크리스마스 배경을 껐어요. 더보기에서 다시 켤 수 있어요.', { label: '되돌리기', onPress: () => { void turn(true); } });
      }
    } catch (caught) {
      onNotice(getApiError(caught).message);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.greeting, night && styles.greetingNight]}>{greeting}</Text>
      <View style={[styles.chip, night && styles.chipNight]}>
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.star}>★</Text>
        <Text style={[styles.chipText, night && styles.chipTextNight]}>{chipLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="크리스마스 배경 끄기"
          hitSlop={10}
          onPress={() => { void turn(false); }}
          style={({ pressed }) => [styles.close, night && styles.closeNight, pressed && styles.pressed]}>
          <Text style={[styles.closeText, night && styles.chipTextNight]}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  wrap: { alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.lg },
  greeting: { color: palette.primaryDark, fontSize: 13, fontWeight: typography.semibold },
  greetingNight: { color: NIGHT_TEXT.accent, ...NIGHT_TEXT_SHADOW },
  chip: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 999, flexDirection: 'row', gap: 6, minHeight: 30, paddingLeft: 11, paddingRight: 4 },
  chipNight: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.28)', borderWidth: 1 },
  star: { color: '#E0A93A', fontSize: 11 },
  chipText: { color: palette.primaryDark, fontSize: 12, fontWeight: typography.semibold },
  chipTextNight: { color: NIGHT_TEXT.strong },
  close: { alignItems: 'center', backgroundColor: palette.primarySoft, borderRadius: 11, height: 22, justifyContent: 'center', width: 22 },
  closeNight: { backgroundColor: 'rgba(255,255,255,0.18)' },
  closeText: { color: palette.primaryDark, fontSize: 14, fontWeight: typography.semibold, lineHeight: 16 },
  pressed: { opacity: 0.65 },
});
