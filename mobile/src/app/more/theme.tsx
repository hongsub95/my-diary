import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { updateProfile } from '@/features/users/user-api';
import { getApiError } from '@/shared/api/api-error';
import { colors, getPalette, spacing, THEME_KEYS, type ThemePalette } from '@/shared/theme';
import { useThemeContext, useThemedStyles } from '@/shared/theme-context';

/**
 * 더보기 > 앱 설정 > 테마.
 *
 * 고르는 즉시 앱 전체에 미리보기를 적용하고, 저장에 실패하면 이전 테마로 되돌린다
 * (docs/DESIGN_SPEC.md 2.3절). 저장을 기다렸다가 바꾸면 색을 비교해볼 수 없고,
 * 되돌리지 않으면 저장되지 않은 색을 계속 보게 된다.
 */
export default function ThemeScreen() {
  const router = useRouter();
  const { updateUser } = useAuth();
  const { themeKey, activeKey, setPreviewKey } = useThemeContext();
  const styles = useThemedStyles(createStyles);

  // 저장에 실패한 키. 되돌린 뒤에도 "무엇을 시도했는지"를 알아야 다시 시도할 수 있다.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(key: string) {
    setError(null);
    setFailedKey(null);
    setSaving(true);
    // 미리보기를 세우면 ThemeProvider가 앱 전체를 그 색으로 다시 그린다.
    setPreviewKey(key);

    try {
      const nextUser = await updateProfile({ themeKey: key });
      // 저장된 값이 사용자 정보로 들어오면 미리보기는 필요 없다. 남겨두면 다른 기기에서
      // 바꾼 값이 들어와도 이 미리보기가 계속 이겨버린다.
      updateUser(nextUser);
      setPreviewKey(null);
    } catch (caught) {
      setPreviewKey(null);
      setFailedKey(key);
      setError(getApiError(caught).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>테마</Text>
        {/* 좌우 폭을 맞춰 제목이 가운데에 오게 한다. */}
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>고른 색은 계정에 저장되어 웹과 앱에서 함께 적용됩니다.</Text>

        <View style={styles.card}>
          {THEME_KEYS.map((key, index) => {
            const palette = getPalette(key);
            // 미리보기 중이라도 선택 표시는 "지금 화면 색"을 따라가야 혼란이 없다.
            const selected = activeKey === key;

            return (
              <View key={key}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: saving }}
                  disabled={saving}
                  onPress={() => save(key)}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                  {/* 색 견본과 이름을 함께 둔다. 견본만 두면 색을 구분하기 어려운
                      사용자가 고를 수 없다(2.3절: 색상만으로 전달하지 않는다).
                      선택 표시도 색이 아니라 체크 기호로 한다. */}
                  <View style={[styles.swatch, { backgroundColor: palette.primary }]} />
                  <Text style={styles.optionLabel}>{palette.label}</Text>
                  {selected ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
                {index < THEME_KEYS.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            );
          })}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            {/* 실패하면 색은 이전으로 돌아가 있다. 무엇을 시도했는지는 failedKey가
                들고 있으므로 같은 선택을 다시 보낼 수 있다. */}
            <Pressable
              disabled={saving || failedKey === null}
              onPress={() => failedKey && save(failedKey)}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
              <Text style={styles.retryText}>
                {getPalette(failedKey).label}(으)로 다시 시도
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* 저장된 값이 목록의 선택과 다를 일은 없지만, 미리보기 중 화면을 떠나면
            서버 값으로 돌아간다는 점을 굳이 숨기지 않는다. */}
        <Text style={styles.hint}>현재 저장된 테마: {getPalette(themeKey).label}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', minHeight: 58, paddingHorizontal: spacing.sm },
  // 터치 영역을 44px 이상으로 유지한다 (docs/BOTTOM_NAVIGATION_SPEC.md 7절).
  headerButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  back: { color: colors.text, fontSize: 28, lineHeight: 30 },
  headerTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  option: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  // 옅은 색 견본이 흰 카드에 묻히지 않도록 테두리를 둔다.
  swatch: { borderColor: 'rgba(0,0,0,0.08)', borderRadius: 12, borderWidth: 1, height: 24, width: 24 },
  optionLabel: { color: colors.text, flex: 1, fontSize: 15 },
  check: { color: palette.primary, fontSize: 16, fontWeight: '700' },
  divider: { backgroundColor: colors.border, height: 1, marginLeft: spacing.lg },
  errorBox: { alignItems: 'flex-start', gap: spacing.sm },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  retry: { backgroundColor: palette.primarySoft, borderRadius: 999, minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md },
  retryText: { color: palette.primaryDark, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
