import { StyleSheet, Text, View } from 'react-native';

import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

/**
 * 하루 만들기 헤더 오른쪽의 단계 표시. 짧은 막대 몇 개와 `1/2`.
 *
 * 예전에는 큰 진행 막대, `1 / 2`, `STEP 1 · 하루 정하기` 세 가지가 같은 정보를 반복했다.
 * 헤더 한 자리로 줄이고 본문은 입력에 내준다(시안 A).
 *
 * @param current 지금 단계 (1부터)
 * @param total 전체 단계 수
 */
export function StepIndicator({ current, total }: { current: number; total: number }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View accessible accessibilityLabel={`${total}단계 중 ${current}단계`} style={styles.root}>
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.bar, index < current && styles.barOn]} />
      ))}
      <Text style={styles.text}>{current}/{total}</Text>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  root: { alignItems: 'center', flexDirection: 'row', gap: 4, justifyContent: 'flex-end', minWidth: 76, paddingRight: 12 },
  bar: { backgroundColor: colors.border, borderRadius: 2, height: 4, width: 16 },
  barOn: { backgroundColor: palette.primary },
  text: { color: colors.muted, fontSize: 12, fontWeight: '600', marginLeft: 4 },
});
