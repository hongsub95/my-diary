import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';

export function LoadingScreen({ message }: { message: string }) {
  const palette = useTheme();

  return (
    <View style={styles.container}>
      <ActivityIndicator color={palette.primary} size="large" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.xl },
  message: { color: colors.muted, textAlign: 'center' },
});
