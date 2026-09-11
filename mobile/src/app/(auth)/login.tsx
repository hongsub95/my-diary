import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { getApiError } from '@/shared/api/api-error';
import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

export default function LoginScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.replace('/(tabs)');
    } catch (caught) {
      setError(getApiError(caught).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>나의 일기</Text>
          <Text style={styles.title}>내일을 계획하고,{`\n`}오늘을 기록해요.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@example.com"
            style={styles.input}
            value={email}
          />
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            autoComplete="password"
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            placeholder="비밀번호를 입력하세요"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            disabled={submitting || !email || !password}
            onPress={handleLogin}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, submitting && styles.disabled]}>
            <Text style={styles.primaryButtonText}>{submitting ? '로그인 중…' : '로그인'}</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          처음이신가요?{' '}
          <Link href="/(auth)/register" style={styles.link}>회원가입</Link>
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl },
  heading: { gap: spacing.sm },
  eyebrow: { color: palette.primary, fontSize: 16, fontWeight: '700' },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', lineHeight: 40 },
  form: { gap: spacing.sm },
  label: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 16, paddingHorizontal: spacing.md, paddingVertical: 15 },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.xs },
  primaryButton: { alignItems: 'center', backgroundColor: palette.primary, borderRadius: 14, marginTop: spacing.md, paddingVertical: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
  footer: { color: colors.muted, textAlign: 'center' },
  link: { color: palette.primary, fontWeight: '700' },
});
