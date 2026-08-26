import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { colors, spacing } from '@/shared/theme';

type MoreMenuItem = {
  key: string;
  label: string;
  // 이 빌드에서 실제로 열 수 있는가. false면 눌리지 않고 '준비 중'으로 표시한다.
  // 화면과 API가 준비되면 true로 바꾸고 이동 코드를 붙이면 된다. 미구현 항목을 눌러
  // 빈 화면이나 오류를 보여주지 않기 위한 장치다(docs/BOTTOM_NAVIGATION_SPEC.md 7절).
  ready: boolean;
  // 소셜 로그인 계정에는 감춰야 하는 항목(같은 문서 6.5절).
  emailAccountOnly?: boolean;
};

// 더보기 안의 항목은 동작이 제각각이라 DB로 관리하지 않고 여기서 관리한다(8.1절).
// 그룹 구성은 6.5절을 따르며, 웹의 frontend/src/features/more/MorePage.jsx와 같은 구성이다.
const MENU_GROUPS: { title: string; items: MoreMenuItem[] }[] = [
  {
    title: '내 정보',
    items: [
      { key: 'profile', label: '프로필 수정', ready: false },
      { key: 'password', label: '비밀번호 변경', ready: false, emailAccountOnly: true },
    ],
  },
  {
    title: '앱 설정',
    items: [
      { key: 'notifications', label: '알림 설정', ready: false },
      { key: 'theme', label: '테마', ready: false },
    ],
  },
  {
    title: '서비스 정보',
    items: [
      { key: 'privacy', label: '개인정보 처리방침', ready: false },
      { key: 'terms', label: '서비스 이용약관', ready: false },
    ],
  },
];

/**
 * 더보기 탭. 프로필 요약과 저빈도 관리 기능을 모아둔 화면이다.
 *
 * 기존 설정 화면을 대체한다. 로그아웃하면 (tabs)/_layout이 로그인 화면으로 보낸다.
 */
export default function MoreScreen() {
  const { logout, user } = useAuth();

  // 소셜 로그인이 생기면 서버가 계정 유형을 내려준다. UserResponse에 아직 그 필드가
  // 없고 소셜 로그인 자체가 미구현이라, 그때까지 이 값은 항상 true다.
  const accountType = (user as { auth_provider?: string } | null)?.auth_provider;
  const canChangePassword = accountType ? accountType === 'email' : true;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>더보기</Text>

        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.nickname.slice(0, 1)}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.nickname}>{user?.nickname}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        {MENU_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.emailAccountOnly || canChangePassword);
          if (items.length === 0) return null;

          return (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={styles.card}>
                {items.map((item, index) => (
                  <View key={item.key}>
                    <Pressable
                      disabled={!item.ready}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                      <Text style={[styles.rowLabel, !item.ready && styles.rowLabelMuted]}>{item.label}</Text>
                      {item.ready ? (
                        <Text style={styles.rowArrow}>›</Text>
                      ) : (
                        <Text style={styles.badge}>준비 중</Text>
                      )}
                    </Pressable>
                    {index < items.length - 1 ? <View style={styles.divider} /> : null}
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {/* 계정 그룹은 되돌리기 어려운 동작이라 일반 탐색 메뉴와 시각적으로 떼어 놓는다(6.5절). */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>계정</Text>
          <Pressable onPress={logout} style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </Pressable>
          {/* 탈퇴는 데이터 처리 안내와 재인증이 함께 필요해(6.5절) API가 생긴 뒤에 연다. */}
          <Pressable disabled style={styles.withdrawButton}>
            <Text style={styles.withdrawText}>계정 탈퇴</Text>
            <Text style={styles.badge}>준비 중</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.xl },
  profile: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', padding: spacing.lg },
  avatar: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  profileText: { gap: 3, marginLeft: spacing.md },
  nickname: { color: colors.text, fontSize: 17, fontWeight: '700' },
  email: { color: colors.muted, fontSize: 14 },
  group: { gap: spacing.sm, marginTop: spacing.xl },
  groupTitle: { color: colors.muted, fontSize: 13, fontWeight: '700', paddingLeft: spacing.xs },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  // 터치 영역을 44px 이상으로 유지한다 (BOTTOM_NAVIGATION_SPEC.md 7절).
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  rowLabel: { color: colors.text, fontSize: 15 },
  // 항목 전체를 흐리게 하면 무엇이 준비 중인지 읽기 어려워진다. 글자색만 낮춘다.
  rowLabelMuted: { color: colors.muted },
  rowArrow: { color: colors.border, fontSize: 22, fontWeight: '700' },
  badge: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 999, borderWidth: 1, color: colors.muted, fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  divider: { backgroundColor: colors.border, height: 1, marginLeft: spacing.lg },
  logoutButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, minHeight: 52, justifyContent: 'center', paddingVertical: 15 },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  withdrawButton: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  withdrawText: { color: colors.muted, fontSize: 14 },
  pressed: { opacity: 0.65 },
});
