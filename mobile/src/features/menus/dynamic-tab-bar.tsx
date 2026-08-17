import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/shared/theme';
import { useNavigableMenus } from './menu-api';
import { tabHref } from './menu-routes';

const iconGlyphs: Record<string, string> = {
  calendar: '▦',
  list: '☰',
  settings: '⚙',
};

type DynamicTabBarProps = {
  state: { index: number; routes: { name: string }[] };
};

export function DynamicTabBar({ state }: DynamicTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: menus = [] } = useNavigableMenus();
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {menus.map((menu) => {
        const active = menu.screen === activeRoute;
        return (
          <Pressable key={menu.code} onPress={() => router.push(tabHref(menu.screen))} style={styles.item}>
            <Text style={[styles.icon, active && styles.active]}>{iconGlyphs[menu.icon ?? ''] ?? '•'}</Text>
            <Text numberOfLines={1} style={[styles.label, active && styles.active]}>{menu.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  item: { alignItems: 'center', flex: 1, gap: 3, minHeight: 52 },
  icon: { color: colors.muted, fontSize: 21, fontWeight: '700' },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  active: { color: colors.primary },
});
