import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, getPalette, spacing, type ThemePalette } from '@/shared/theme';
import { useThemeContext, useThemedStyles } from '@/shared/theme-context';
import { useNavigableMenus } from './menu-api';
import { MenuIcon } from './menu-icon';
import { tabHref } from './menu-routes';

type DynamicTabBarProps = {
  state: { index: number; routes: { name: string }[] };
};

export function DynamicTabBar({ state }: DynamicTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: menus = [] } = useNavigableMenus();
  const styles = useThemedStyles(createStyles);
  const { activeKey } = useThemeContext();
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {menus.map((menu) => {
        const active = menu.screen === activeRoute;
        return (
          <Pressable key={menu.code} onPress={() => router.push(tabHref(menu.screen))} style={styles.item}>
            <MenuIcon name={menu.code || menu.icon || ''} size={21} color={active ? getPalette(activeKey).primary : colors.muted} />
            <Text numberOfLines={1} style={[styles.label, active && styles.active]}>{menu.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  item: { alignItems: 'center', flex: 1, gap: 3, minHeight: 52 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  active: { color: palette.primary },
});
