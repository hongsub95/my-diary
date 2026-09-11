import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { updateProfile } from '@/features/users/user-api';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing } from '@/shared/theme';

/**
 * 더보기 > 내 정보 > 프로필 수정.
 *
 * 지금 바꿀 수 있는 값은 닉네임뿐이다. 이메일은 로그인 수단이라 본인 확인 절차가
 * 따로 필요하고(docs/API_SPEC.md 3-U절), 그 절차가 정해지기 전까지 서버도 받지 않는다.
 * 입력칸만 막아 두면 고장 난 것으로 오해하므로 왜 못 바꾸는지 함께 적는다.
 */
export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmed = nickname.trim();
  // 값이 그대로면 저장할 것이 없다. 서버는 같은 닉네임 재저장을 허용하지만(3-U절),
  // 아무것도 안 바뀌는 요청을 보내고 화면을 닫는 것보다 버튼을 잠그는 편이 정직하다.
  const changed = trimmed.length > 0 && trimmed !== user?.nickname;

  async function handleSubmit() {
    if (!changed || submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      const nextUser = await updateProfile({ nickname: trimmed });
      // 컨텍스트를 갱신해야 더보기 상단 카드와 아바타가 곧바로 새 이름을 보여준다.
      updateUser(nextUser);
      // 따로 알림을 띄우지 않는다. 돌아간 화면에 바뀐 이름이 그대로 보이는 것이
      // 가장 확실한 확인이다.
      router.back();
    } catch (caught) {
      // 닉네임 중복(409)과 길이 규칙(422) 모두 서버가 한국어 문구를 내려준다.
      setError(getApiError(caught).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>프로필 수정</Text>
        {/* 좌우 폭을 맞춰 제목이 가운데에 오게 한다. */}
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>닉네임</Text>
              <TextInput
                accessibilityLabel="닉네임"
                autoCapitalize="none"
                maxLength={50}
                onChangeText={setNickname}
                placeholder="2~50자"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={nickname}
              />
              <Text style={styles.hint}>함께 쓰는 스페이스에서 이 이름으로 보입니다.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                accessibilityLabel="이메일"
                editable={false}
                style={[styles.input, styles.inputReadonly]}
                value={user?.email ?? ''}
              />
              <Text style={styles.hint}>로그인에 쓰는 주소라 여기서는 바꿀 수 없습니다.</Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={!changed || submitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submit,
              (!changed || submitting) && styles.submitDisabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.submitText}>{submitting ? '저장 중…' : '저장'}</Text>
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
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: spacing.lg, padding: spacing.lg },
  field: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 15, minHeight: 48, paddingHorizontal: spacing.md },
  // 바꿀 수 없는 값. 입력칸 모양은 유지해 무엇이 들어 있는지 읽히게 하되, 손댈 수
  // 없다는 것은 색으로 알린다. 아래 hint가 이유를 설명한다.
  inputReadonly: { color: colors.muted },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  submit: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 16, justifyContent: 'center', minHeight: 52 },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
