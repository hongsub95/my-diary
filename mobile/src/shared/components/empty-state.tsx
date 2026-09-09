import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/shared/theme';

type EmptyStateProps = {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

/** 목록과 콘텐츠 영역에서 같은 말투와 시각 구조로 보여주는 빈 상태. */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.visual, compact && styles.visualCompact]}>
        <Text style={[styles.icon, compact && styles.iconCompact]}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 7, paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  containerCompact: { paddingVertical: spacing.xl },
  visual: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 32, height: 64, justifyContent: 'center', marginBottom: 5, width: 64 },
  visualCompact: { borderRadius: 26, height: 52, width: 52 },
  icon: { fontSize: 29 },
  iconCompact: { fontSize: 24 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  description: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' },
  action: { backgroundColor: colors.primary, borderRadius: 14, justifyContent: 'center', marginTop: spacing.sm, minHeight: 44, paddingHorizontal: spacing.lg },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.82 },
});
