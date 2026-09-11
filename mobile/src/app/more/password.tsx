import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { changePassword } from '@/features/users/user-api';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

/**
 * 더보기 > 내 정보 > 비밀번호 변경.
 *
 * 현재 비밀번호를 함께 받는다. 잠금 해제된 폰을 잠깐 빌린 사람이 비밀번호만 바꿔
 * 계정을 가져가는 것을 막기 위해서다(docs/API_SPEC.md 3-U절).
 *
 * 확인용 입력칸은 서버에 보내지 않는다. 서버가 검사할 수 없는 종류의 실수(오타)를
 * 화면에서 잡는 용도이고, 이걸 보내면 쓰지도 않을 평문 비밀번호를 한 번 더 네트워크에
 * 싣게 된다.
 */
export default function PasswordChangeScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const styles = useThemedStyles(createStyles);

  const filled = current.length > 0 && next.length > 0 && confirm.length > 0;

  async function handleSubmit() {
    if (!filled || submitting) return;

    if (next !== confirm) {
      setError('새 비밀번호가 서로 다릅니다.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      // 앱은 로그아웃되지 않는다(3-U절). 화면에 흔적이 남지 않는 작업이라 돌아가기 전에
      // 한 번 알려야 됐는지 알 수 있다.
      Alert.alert('비밀번호를 변경했습니다.', '다른 기기의 웹 로그인은 해제되었습니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } catch (caught) {
      // 현재 비밀번호가 틀리면 422다. 401이 아니라서 이 화면이 유지되고, 사용자는
      // 다시 입력할 수 있다.
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
        <Text style={styles.headerTitle}>비밀번호 변경</Text>
        {/* 좌우 폭을 맞춰 제목이 가운데에 오게 한다. */}
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>현재 비밀번호</Text>
              <TextInput
                accessibilityLabel="현재 비밀번호"
                autoCapitalize="none"
                onChangeText={setCurrent}
                secureTextEntry
                style={styles.input}
                textContentType="password"
                value={current}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>새 비밀번호</Text>
              <TextInput
                accessibilityLabel="새 비밀번호"
                autoCapitalize="none"
                onChangeText={setNext}
                secureTextEntry
                style={styles.input}
                textContentType="newPassword"
                value={next}
              />
              <Text style={styles.hint}>9자 이상, 영문·숫자·특수문자를 각각 1개 이상 포함해주세요.</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>새 비밀번호 확인</Text>
              <TextInput
                accessibilityLabel="새 비밀번호 확인"
                autoCapitalize="none"
                onChangeText={setConfirm}
                secureTextEntry
                style={styles.input}
                textContentType="newPassword"
                value={confirm}
              />
            </View>
          </View>

          {/* 다른 기기가 끊긴다는 사실을 누르기 전에 알린다. 바꾸고 나서 발견하면
              고장으로 오해한다. 앱이 끊기지 않는 것도 함께 적어야 "왜 폰은 그대로지"
              하는 의심이 남지 않는다. */}
          <Text style={styles.notice}>
            비밀번호를 바꾸면 다른 기기에서 열어둔 웹 로그인이 해제됩니다. 이 앱은 그대로
            유지됩니다.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={!filled || submitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submit,
              (!filled || submitting) && styles.submitDisabled,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.submitText}>{submitting ? '변경 중…' : '비밀번호 변경'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
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
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  notice: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.muted, fontSize: 12, lineHeight: 19, padding: spacing.md },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  submit: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 16, justifyContent: 'center', minHeight: 52 },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
