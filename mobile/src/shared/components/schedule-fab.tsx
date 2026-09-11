import { Pressable, StyleSheet, Text } from 'react-native';

import { type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

export function ScheduleFab({ onPress }: { onPress: () => void }) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityLabel="새 일정 만들기"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      testID="schedule-fab"
    >
      <Text aria-hidden style={styles.icon}>＋</Text>
    </Pressable>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: 28,
    bottom: 16,
    elevation: 6,
    height: 56,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    width: 56,
    zIndex: 10,
  },
  icon: { color: '#FFFFFF', fontSize: 30, fontWeight: '400', lineHeight: 34 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
});
