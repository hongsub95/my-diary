import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { getApiError } from '@/shared/api/api-error';
import { utf8ByteLength } from '@/shared/utils/text';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

const SPECIAL_CHARACTERS = `!"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`;

function satisfiesPasswordPolicy(value: string) {
  return (
    value.length >= 9 &&
    /[A-Za-z]/.test(value) &&
    /[0-9]/.test(value) &&
    [...value].some((character) => SPECIAL_CHARACTERS.includes(character))
  );
}

type FieldErrors = Partial<Record<'email' | 'nickname' | 'password', string>>;

export default function RegisterScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister() {
    const errors: FieldErrors = {};
    if (!satisfiesPasswordPolicy(password)) {
      errors.password = '9자 이상이며 영문, 숫자, 특수문자를 각각 1개 이상 포함해 주세요.';
    }
    if (utf8ByteLength(password) > 72) errors.password = '비밀번호가 너무 깁니다. 조금 짧게 입력해주세요.';
    if (nickname.trim().length < 2) errors.nickname = '닉네임은 2자 이상이어야 합니다.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setGeneralError(null);
    setSubmitting(true);
    try {
      await register({ email: email.trim(), nickname: nickname.trim(), password });
      router.replace('/(tabs)');
    } catch (caught) {
      const apiError = getApiError(caught);
      if (apiError.field === 'email' || apiError.field === 'nickname' || apiError.field === 'password') {
        setFieldErrors({ [apiError.field]: apiError.message });
      } else {
        setGeneralError(apiError.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.description}>계정을 만들면 개인 일정 공간이 함께 생성됩니다.</Text>

          <Text style={styles.label}>이메일</Text>
          <TextInput autoCapitalize="none" keyboardType="email-address" onChangeText={setEmail} style={styles.input} value={email} />
          {fieldErrors.email ? <Text style={styles.error}>{fieldErrors.email}</Text> : null}

          <Text style={styles.label}>닉네임</Text>
          <TextInput maxLength={50} onChangeText={setNickname} style={styles.input} value={nickname} />
          {fieldErrors.nickname ? <Text style={styles.error}>{fieldErrors.nickname}</Text> : null}

          <Text style={styles.label}>비밀번호</Text>
          <TextInput onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />
          <Text style={styles.hint}>9자 이상 · 영문, 숫자, 특수문자 포함</Text>
          {fieldErrors.password ? <Text style={styles.error}>{fieldErrors.password}</Text> : null}
          {generalError ? <Text style={styles.error}>{generalError}</Text> : null}

          <Pressable disabled={submitting || !email || !nickname || !password} onPress={handleRegister} style={({ pressed }) => [styles.button, pressed && styles.pressed, submitting && styles.disabled]}>
            <Text style={styles.buttonText}>{submitting ? '가입 중…' : '가입하고 시작하기'}</Text>
          </Pressable>

          <Text style={styles.footer}>이미 계정이 있나요? <Link href="/(auth)/login" style={styles.link}>로그인</Link></Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, paddingVertical: spacing.xxl },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 15, marginBottom: spacing.lg, marginTop: spacing.sm },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 16, paddingHorizontal: spacing.md, paddingVertical: 15 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  button: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 14, marginTop: spacing.xl, paddingVertical: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footer: { color: colors.muted, marginTop: spacing.lg, textAlign: 'center' },
  link: { color: palette.primary, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
});
