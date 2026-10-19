import { StyleSheet, View } from 'react-native';

import { colors, getPalette, radii } from '@/shared/theme';
import { useTheme } from '@/shared/theme-context';
import { MenuIcon } from './menu-icon';

// Decorative tones reuse existing presets; they are not additional user themes.
const MENU_TONES: Record<string, string> = {
  calendar: 'orange',
  schedules: 'emerald',
  list: 'emerald',
  records: 'purple',
  book: 'purple',
  space: 'purple',
};

type IconBadgeProps = {
  name: string;
  compact?: boolean;
  muted?: boolean;
};

export function IconBadge({ name, compact = false, muted = false }: IconBadgeProps) {
  const currentPalette = useTheme();
  const palette = MENU_TONES[name] ? getPalette(MENU_TONES[name]) : currentPalette;

  return (
    <View
      accessible={false}
      style={[
        styles.badge,
        compact && styles.compact,
        { backgroundColor: compact || muted ? colors.surfaceMuted : palette.primarySoft },
      ]}>
      <MenuIcon name={name} size={compact ? 19 : 23} color={compact || muted ? colors.muted : palette.primaryDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', borderRadius: radii.md, height: 44, justifyContent: 'center', width: 44 },
  compact: { borderRadius: radii.sm, height: 32, width: 32 },
});
