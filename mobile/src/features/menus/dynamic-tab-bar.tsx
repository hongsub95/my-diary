import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, getPalette, radii, spacing, type ThemePalette } from '@/shared/theme';
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
    <View style={[styles.safeArea, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.container}>
      {menus.map((menu) => {
        const active = menu.screen === activeRoute;
        return (
          <Pressable key={menu.code} onPress={() => router.push(tabHref(menu.screen))} style={[styles.item, active && styles.itemActive]}>
            <MenuIcon name={menu.code || menu.icon || ''} size={21} color={active ? getPalette(activeKey).primary : colors.muted} />
            <Text numberOfLines={1} style={[styles.label, active && styles.active]}>{menu.name}</Text>
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, paddingHorizontal: 10, paddingTop: 4 },
  container: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, elevation: 12, flexDirection: 'row', paddingHorizontal: 6, paddingTop: 6, shadowColor: '#432F28', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 18 },
  item: { alignItems: 'center', borderRadius: radii.lg, flex: 1, gap: 3, justifyContent: 'center', minHeight: 54 },
  itemActive: { backgroundColor: palette.primarySoft },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  active: { color: palette.primaryDark },
});
