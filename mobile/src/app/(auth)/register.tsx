import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { LEGAL_DOCUMENTS } from '@/features/legal/legal-api';
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
  // 동의는 셋 다 필수다. 서버도 같은 규칙으로 막지만(app/auth/schemas.py) 화면에서
  // 먼저 걸러 왕복을 줄인다.
  const [consent, setConsent] = useState({ terms: false, privacy: false, age: false });
  const allAgreed = consent.terms && consent.privacy && consent.age;

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
      await register({ email: email.trim(), nickname: nickname.trim(), password, consent });
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

          <View style={styles.consent}>
            <Text style={styles.consentTitle}>필수 동의</Text>

            <ConsentRow
              checked={consent.age}
              onToggle={() => setConsent((current) => ({ ...current, age: !current.age }))}
              styles={styles}>
              <Text style={styles.consentText}>만 14세 이상입니다</Text>
            </ConsentRow>

            <ConsentRow
              checked={consent.terms}
              onToggle={() => setConsent((current) => ({ ...current, terms: !current.terms }))}
              styles={styles}>
              <Text style={styles.consentText}>
                <Link href={{ pathname: '/more/legal/[code]', params: { code: LEGAL_DOCUMENTS.terms } }} style={styles.link}>
                  서비스 이용약관
                </Link>
                에 동의합니다
              </Text>
            </ConsentRow>

            <ConsentRow
              checked={consent.privacy}
              onToggle={() => setConsent((current) => ({ ...current, privacy: !current.privacy }))}
              styles={styles}>
              <Text style={styles.consentText}>
                <Link href={{ pathname: '/more/legal/[code]', params: { code: LEGAL_DOCUMENTS.privacy } }} style={styles.link}>
                  개인정보 처리방침
                </Link>
                에 동의합니다
              </Text>
            </ConsentRow>

            {/* 탈퇴해도 함께 쓴 기록이 남는 것은 가입 전에 알아야 하는 내용이다
                (app/legal/documents/terms-of-service.md 제7조). */}
            <Text style={styles.consentNotice}>
              함께 쓰는 공간에 올린 사진과 일기는 그 공간의 구성원이 볼 수 있고, 탈퇴해도
              공간에 남습니다.
            </Text>
          </View>

          {generalError ? <Text style={styles.error}>{generalError}</Text> : null}

          <Pressable disabled={submitting || !email || !nickname || !password || !allAgreed} onPress={handleRegister} style={({ pressed }) => [styles.button, pressed && styles.pressed, submitting && styles.disabled]}>
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
  consent: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: spacing.md, marginTop: spacing.lg, padding: spacing.md },
  consentTitle: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  // 네모와 글자를 하나의 터치 영역으로 묶는다. 작은 네모만 눌러야 하면 자꾸 빗나간다.
  consentRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, minHeight: 32 },
  checkbox: { alignItems: 'center', borderColor: colors.border, borderRadius: 6, borderWidth: 1, height: 22, justifyContent: 'center', marginTop: 1, width: 22 },
  checkboxOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  checkMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  consentText: { color: colors.text, flex: 1, fontSize: 14, lineHeight: 22 },
  consentNotice: { borderTopColor: colors.border, borderTopWidth: 1, color: colors.muted, fontSize: 12, lineHeight: 19, paddingTop: spacing.md },
});

/**
 * 체크 한 줄. 네모와 글자를 함께 눌러야 모바일에서 빗나가지 않는다.
 *
 * 선택 상태를 색이 아니라 체크 기호로도 알린다. 색만으로 전달하면 색 구분이 어려운
 * 사용자가 동의 여부를 알 수 없다.
 */
function ConsentRow({
  checked,
  onToggle,
  styles,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  styles: ReturnType<typeof createStyles>;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.consentRow}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      {children}
    </Pressable>
  );
}
