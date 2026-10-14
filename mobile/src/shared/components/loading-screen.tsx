import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/shared/theme';
import { LoadingIndicator } from './loading-indicator';

export function LoadingScreen({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <LoadingIndicator message={message} stacked />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.xl },
});
