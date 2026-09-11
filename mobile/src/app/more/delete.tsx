import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { listSpaces } from '@/features/spaces/space-api';
import { deleteAccount } from '@/features/users/user-api';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing } from '@/shared/theme';

// 실수로 누르는 것을 막는 마지막 관문. 비밀번호만 받으면 확인 버튼을 습관적으로 누르는
// 사람을 못 막는다. 정해진 글자를 직접 쳐야 넘어간다
// (docs/SPACE_MODEL_SPEC.md 7.4절이 스페이스 삭제에 요구하는 것과 같은 장치다).
const CONFIRM_WORD = '탈퇴합니다';

/**
 * 더보기 > 계정 > 계정 탈퇴.
 *
 * 되돌릴 수 없는 동작이라 세 가지를 요구한다.
 * 1. 무엇이 사라지는지 읽게 한다 (내가 owner인 공유 스페이스는 남은 멤버가 있어도 함께 보관된다)
 * 2. 확인 문구를 직접 입력하게 한다
 * 3. 비밀번호로 재인증한다 (docs/BOTTOM_NAVIGATION_SPEC.md 6.5절)
 */
export default function AccountDeleteScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 경고 문구를 만들려면 내가 owner인 스페이스를 알아야 한다. 전용 API를 두지 않고
  // 스페이스 목록으로 계산한다 — 서버가 이미 my_role과 member_count를 준다.
  const spaces = useQuery({ queryKey: ['spaces'], queryFn: listSpaces });

  const ownedShared = (spaces.data ?? []).filter(
    (space) => space.my_role === 'owner' && space.type === 'shared',
  );
  // 나를 뺀 인원이 접근을 잃는 사람 수다.
  const affectedMembers = ownedShared.reduce(
    (total, space) => total + Math.max(space.member_count - 1, 0),
    0,
  );

  const canSubmit = confirmText.trim() === CONFIRM_WORD && password.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;

    setError(null);
    setSubmitting(true);
    try {
      await deleteAccount({ currentPassword: password });
    } catch (caught) {
      // 비밀번호가 틀리면 422다. 이때는 아무것도 지워지지 않았으므로 화면을 유지한다.
      setError(getApiError(caught).message);
      setSubmitting(false);
      return;
    }

    // 여기부터는 계정이 이미 사라졌다. 무엇이 실패해도 사용자에게 오류를 보여주지 않는다.
    try {
      await logout();
    } catch {
      // logout()은 서버에 POST /auth/logout을 부르는데, 방금 탈퇴해서 그 요청은 401이
      // 난다. 토큰 비우기와 비로그인 전환은 logout 내부의 finally에서 이미 끝나 있으므로
      // 여기서 할 일은 없다. 이걸 잡지 않으면 탈퇴에 성공하고도 "세션이 만료되었습니다"가
      // 뜬다.
    }

    // 이 화면은 탭 밖(루트 스택)이라 (tabs)/_layout의 로그인 리다이렉트가 닿지 않는다.
    // 직접 보내지 않으면 계정이 없는 채로 이 화면에 남는다.
    router.replace('/(auth)/login');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>계정 탈퇴</Text>
        {/* 좌우 폭을 맞춰 제목이 가운데에 오게 한다. */}
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.danger}>
            <Text style={styles.dangerTitle}>탈퇴하면 되돌릴 수 없습니다</Text>
            <Text style={styles.dangerItem}>· {user?.email} 계정으로 다시 로그인할 수 없습니다.</Text>
            <Text style={styles.dangerItem}>· 같은 이메일과 닉네임으로 다시 가입할 수 없습니다.</Text>
            <Text style={styles.dangerItem}>· 내가 만든 스페이스는 함께 사라집니다. 남은 멤버도 열 수 없습니다.</Text>
            <Text style={styles.dangerItem}>· 남긴 일기와 사진은 지워지지 않고 기록으로 남습니다.</Text>
          </View>

          {/* 내가 owner인 공유 스페이스는 남의 하루까지 함께 닫는다. 숫자로 보여주지
              않으면 "내 것만 지우는 것"으로 오해한다. */}
          {ownedShared.length > 0 ? (
            <View style={[styles.danger, styles.spacesCard]}>
              <Text style={styles.spacesTitle}>함께 사라지는 스페이스 {ownedShared.length}개</Text>
              {ownedShared.map((space) => (
                <Text key={space.id} style={styles.dangerItem}>
                  · {space.name} <Text style={styles.count}>멤버 {space.member_count}명</Text>
                </Text>
              ))}
              {affectedMembers > 0 ? (
                <Text style={styles.dangerNote}>
                  나를 포함하지 않은 {affectedMembers}명이 이 스페이스의 일정과 기록에 더 이상
                  접근할 수 없게 됩니다.
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>확인을 위해 “{CONFIRM_WORD}”를 입력해주세요</Text>
              <TextInput
                accessibilityLabel="확인 문구"
                autoCapitalize="none"
                onChangeText={setConfirmText}
                placeholder={CONFIRM_WORD}
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={confirmText}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput
                accessibilityLabel="비밀번호"
                autoCapitalize="none"
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                textContentType="password"
                value={password}
              />
              <Text style={styles.hint}>본인 확인을 위해 한 번 더 입력받습니다.</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submit,
              !canSubmit && styles.submitDisabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.submitText}>{submitting ? '탈퇴 처리 중…' : '계정 탈퇴'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  flex: { flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: spacing.sm },
  // 터치 영역을 44px 이상으로 유지한다 (docs/BOTTOM_NAVIGATION_SPEC.md 7절).
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  back: { color: colors.text, fontSize: 28, lineHeight: 30 },
  headerTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  // 되돌릴 수 없는 동작이라 일반 카드와 테두리 색으로 구분한다. 같은 카드에 담으면
  // 읽지 않고 넘어간다.
  danger: { backgroundColor: colors.surface, borderColor: colors.danger, borderRadius: 18, borderWidth: 1, gap: 6, padding: spacing.lg },
  spacesCard: { borderColor: colors.border },
  dangerTitle: { color: colors.danger, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  spacesTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  dangerItem: { color: colors.text, fontSize: 13, lineHeight: 20 },
  count: { color: colors.muted },
  dangerNote: { color: colors.danger, fontSize: 12, lineHeight: 19, marginTop: 6 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.lg, padding: spacing.lg },
  field: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 15, minHeight: 48, paddingHorizontal: spacing.md },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  submit: { alignItems: 'center', backgroundColor: colors.danger, borderRadius: 16, justifyContent: 'center', minHeight: 52 },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
