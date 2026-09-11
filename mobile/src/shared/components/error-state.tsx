import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.button}><Text style={styles.buttonText}>다시 시도</Text></Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.xl },
  message: { color: colors.muted, lineHeight: 22, textAlign: 'center' },
  button: { backgroundColor: palette.primary, borderRadius: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
