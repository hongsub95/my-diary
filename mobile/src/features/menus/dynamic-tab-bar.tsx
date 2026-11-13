import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GROUND_BOTTOM } from '@/features/seasonal/scene-colors';
import { scopeForTab } from '@/features/seasonal/season-rules';
import { useSeasonal } from '@/features/seasonal/seasonal-context';
import { SnowCapped } from '@/features/seasonal/snow-cap';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';
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
  const palette = useTheme();
  const activeRoute = state.routes[state.index]?.name;
  // 계절 배경이 화면 전체에 깔린 탭이면, 탭 바 뒤를 골목 땅과 같은 눈밭 색으로 이어 붙이고
  // 탭 바 윗변에도 눈을 얹는다. 탭 바는 화면 밖에 그려져서 화면의 장면이 여기까지 오지 않는다.
  const seasonal = useSeasonal();
  const snowy = seasonal.visible && scopeForTab(activeRoute) === 'full';

  return (
    <View style={[styles.safeArea, snowy && styles.snowField, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <SnowCapped show={snowy} night={seasonal.night}>
      <View style={styles.container}>
        {menus.map((menu) => {
          const active = menu.screen === activeRoute;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={menu.name}
              accessibilityState={{ selected: active }}
              aria-selected={active}
              key={menu.code}
              onPress={() => router.push(tabHref(menu.screen))}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <View style={[styles.icon, active && styles.iconActive]}>
                <MenuIcon name={menu.code || menu.icon || ''} size={21} color={active ? palette.primaryDark : colors.muted} />
              </View>
              <Text numberOfLines={1} style={[styles.label, active && styles.active]}>{menu.name}</Text>
            </Pressable>
          );
        })}
      </View>
      </SnowCapped>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  snowField: { backgroundColor: GROUND_BOTTOM },
  container: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.card, borderWidth: 1, elevation: 6, flexDirection: 'row', paddingHorizontal: spacing.xs, paddingVertical: 6, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14 },
  item: { alignItems: 'center', borderRadius: radii.lg, flex: 1, gap: spacing.xs, justifyContent: 'center', minHeight: 54, minWidth: 44, paddingVertical: spacing.xs },
  icon: { alignItems: 'center', borderRadius: radii.sm, justifyContent: 'center', minHeight: 28, width: 44 },
  iconActive: { backgroundColor: palette.primarySoft },
  label: { color: colors.muted, fontSize: 11, fontWeight: typography.regular },
  active: { color: palette.primaryDark, fontWeight: typography.semibold },
  pressed: { opacity: 0.65 },
});
