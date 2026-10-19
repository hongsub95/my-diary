import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { LEGAL_DOCUMENTS } from '@/features/legal/legal-api';
import { buildAllMenus } from '@/features/menus/all-menus';
import { IconBadge } from '@/features/menus/icon-badge';
import { useNavigableMenus } from '@/features/menus/menu-api';
import { MenuIcon } from '@/features/menus/menu-icon';
import { useSpaces } from '@/features/spaces/space-context';
import { Snackbar, useSnackbar } from '@/shared/components/snackbar';
import { colors, radii, spacing, typography, type ThemePalette } from '@/shared/theme';
import { useTheme, useThemedStyles } from '@/shared/theme-context';

type MoreMenuItem = {
  key: string;
  label: string;
  // Unimplemented settings stay disabled until their screen and API are ready.
  href?: '/more/password' | '/more/theme';
  legalCode?: string;
  emailAccountOnly?: boolean;
};

const MENU_GROUPS: { title: string; items: MoreMenuItem[] }[] = [
  {
    title: '나에게 맞추기',
    items: [
      { key: 'password', label: '비밀번호 변경', href: '/more/password', emailAccountOnly: true },
      { key: 'notifications', label: '알림 설정' },
      { key: 'theme', label: '테마', href: '/more/theme' },
    ],
  },
  {
    title: '서비스 안내',
    items: [
      { key: 'privacy', label: '개인정보 처리방침', legalCode: LEGAL_DOCUMENTS.privacy },
      { key: 'terms', label: '서비스 이용약관', legalCode: LEGAL_DOCUMENTS.terms },
    ],
  },
];

/** Profile, spaces, navigation and less frequent account settings. */
export default function MoreScreen() {
  const { logout, user } = useAuth();
  const { currentSpace } = useSpaces();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const palette = useTheme();
  const menuQuery = useNavigableMenus();
  const { notice, showSnackbar, dismissSnackbar } = useSnackbar();

  useEffect(() => {
    if (menuQuery.error) showSnackbar('메뉴를 불러오지 못했어요. 다시 시도해 주세요.');
  }, [menuQuery.error, showSnackbar]);

  // Accounts without provider metadata are currently email accounts.
  const accountType = (user as { auth_provider?: string } | null)?.auth_provider;
  const canChangePassword = accountType ? accountType === 'email' : true;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>더보기</Text>
          <Text style={styles.brand}>나의 일기 <Text style={styles.brandAccent}>(내일)</Text></Text>
        </View>

        <View style={styles.profile}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <MenuIcon name="smile" size={29} color={palette.primaryDark} />
            </View>
            <View style={styles.profileText}>
              <Text numberOfLines={2} style={styles.nickname}>{user?.nickname ?? '나'}님</Text>
              <Text numberOfLines={1} style={styles.email}>{user?.email}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="프로필 수정"
              onPress={() => router.push('/more/profile')}
              style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
              <MenuIcon name="edit" size={19} color={palette.primaryDark} />
            </Pressable>
          </View>
          <Text style={styles.profileNote}>나답게 쌓아가는 하루</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`나의 공간, ${currentSpace?.name ?? '공간 바꾸기 및 관리'}. 바꾸기`}
          onPress={() => router.push('/spaces')}
          style={({ pressed }) => [styles.spaceCard, pressed && styles.pressed]}>
          <IconBadge name="space" />
          <View style={styles.spaceText}>
            <Text style={styles.eyebrow}>나의 공간</Text>
            <Text style={styles.spaceName} numberOfLines={2}>{currentSpace?.name ?? '공간 바꾸기 · 관리'}</Text>
          </View>
          <View style={styles.spaceAction}>
            <Text style={styles.smallText}>바꾸기</Text>
            <MenuIcon name="chevron-right" size={15} color={colors.muted} />
          </View>
        </Pressable>

        <View style={styles.group}>
          <Text accessibilityRole="header" style={styles.groupTitle}>전체 메뉴</Text>
          <View style={styles.menuPanel}>
            <View style={styles.menuGrid}>
              {buildAllMenus(menuQuery.data ?? []).map(menu => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={menu.name}
                  key={menu.code}
                  onPress={() => router.navigate(menu.href)}
                  style={({ pressed }) => [styles.menuTile, pressed && styles.pressed]}>
                  <IconBadge name={menu.code} />
                  <Text style={styles.menuLabel}>{menu.name}</Text>
                </Pressable>
              ))}
            </View>
            {menuQuery.isPending && <Text style={styles.rowValueText}>메뉴를 불러오고 있어요.</Text>}
            {menuQuery.isError && (
              <Pressable accessibilityRole="button" onPress={() => menuQuery.refetch()} style={styles.menuRetry}>
                <Text style={styles.menuRetryText}>메뉴 다시 불러오기</Text>
              </Pressable>
            )}
          </View>
        </View>

        {MENU_GROUPS.map(group => {
          const items = group.items.filter(item => !item.emailAccountOnly || canChangePassword);
          return (
            <View key={group.title} style={styles.group}>
              <Text accessibilityRole="header" style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.card}>
                {items.map((item, index) => {
                  const disabled = !item.href && !item.legalCode;
                  return (
                    <View key={item.key}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled }}
                        disabled={disabled}
                        onPress={
                          item.legalCode
                            ? () => router.push({ pathname: '/more/legal/[code]', params: { code: item.legalCode! } })
                            : item.href
                              ? () => router.push(item.href!)
                              : undefined
                        }
                        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                        <IconBadge name={item.key} compact muted={disabled} />
                        <Text style={[styles.rowLabel, disabled && styles.rowLabelMuted]}>{item.label}</Text>
                        {item.key === 'theme' && (
                          <View style={styles.rowValue}>
                            <View style={styles.rowSwatch} />
                            <Text style={styles.rowValueText}>{palette.label}</Text>
                          </View>
                        )}
                        {disabled
                          ? <Text style={styles.badge}>준비 중</Text>
                          : <MenuIcon name="chevron-right" size={16} color={colors.muted} />}
                      </Pressable>
                      {index < items.length - 1 && <View style={styles.divider} />}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={styles.account}>
          <Pressable accessibilityRole="button" onPress={logout} style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}>
            <MenuIcon name="logout" size={16} color={colors.muted} />
            <Text style={styles.accountText}>로그아웃</Text>
          </Pressable>
          <Text accessible={false} style={styles.accountSeparator}>·</Text>
          {/* This only opens the account deletion explanation and reauthentication flow. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/more/delete')}
            style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}>
            <Text style={styles.accountText}>계정 탈퇴</Text>
          </Pressable>
        </View>
        <Text style={styles.signature}>계획한 하루가, 소중한 기억으로.</Text>
      </ScrollView>
      <Snackbar notice={notice} onDismiss={dismissSnackbar} />
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.lg },
  header: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between', marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold },
  brand: { color: colors.muted, fontSize: 11, fontWeight: typography.regular },
  brandAccent: { color: palette.primaryDark },
  profile: { backgroundColor: palette.primarySoft, borderRadius: radii.card, gap: spacing.md, padding: spacing.lg },
  profileTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  avatar: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, height: 48, justifyContent: 'center', transform: [{ rotate: '-5deg' }], width: 48 },
  profileText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  nickname: { color: colors.text, fontSize: typography.heading, fontWeight: typography.semibold },
  email: { color: colors.muted, fontSize: typography.body, fontWeight: typography.regular },
  editButton: { alignItems: 'center', borderRadius: radii.full, justifyContent: 'center', minHeight: 44, minWidth: 44 },
  profileNote: { color: palette.primaryDark, fontSize: typography.body, fontWeight: typography.regular },
  spaceCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.card, flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, minHeight: 76, padding: spacing.md },
  spaceText: { flex: 1, gap: spacing.xs, minWidth: 0 },
  eyebrow: { color: colors.muted, fontSize: 12, fontWeight: typography.regular },
  spaceName: { color: colors.text, fontSize: typography.body, fontWeight: typography.semibold },
  spaceAction: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  smallText: { color: colors.muted, fontSize: 12, fontWeight: typography.regular },
  group: { gap: spacing.md, marginTop: spacing.xl },
  groupTitle: { color: colors.text, fontSize: typography.body, fontWeight: typography.semibold, paddingLeft: spacing.xs },
  menuPanel: { backgroundColor: colors.surface, borderRadius: radii.card, elevation: 1, gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.lg, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.035, shadowRadius: 14 },
  menuGrid: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg },
  menuTile: { alignItems: 'center', gap: spacing.sm, justifyContent: 'center', minHeight: 72, paddingHorizontal: spacing.xs, width: '33.333333%' },
  menuLabel: { color: colors.text, fontSize: typography.body, fontWeight: typography.regular, textAlign: 'center' },
  menuRetry: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  menuRetryText: { color: palette.primaryDark, fontSize: typography.body, fontWeight: typography.semibold },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: 'hidden', paddingHorizontal: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 58, paddingVertical: spacing.sm },
  rowLabel: { color: colors.text, flex: 1, fontSize: typography.body, fontWeight: typography.regular },
  rowLabelMuted: { color: colors.muted },
  rowValue: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  rowSwatch: { backgroundColor: palette.primary, borderRadius: radii.full, height: 10, width: 10 },
  rowValueText: { color: colors.muted, fontSize: 12, fontWeight: typography.regular },
  badge: { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, color: colors.muted, fontSize: 11, fontWeight: typography.regular, overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  divider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginLeft: 40 },
  account: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg },
  accountButton: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: spacing.xs },
  accountText: { color: colors.muted, fontSize: 12, fontWeight: typography.regular },
  accountSeparator: { color: colors.muted },
  signature: { color: colors.muted, fontSize: 11, fontWeight: typography.regular, marginTop: spacing.xs, textAlign: 'center' },
  pressed: { opacity: 0.65 },
});
