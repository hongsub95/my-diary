import { type Href, useRouter } from 'expo-router';
import { type PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

export function SpaceFrame({ title, back = '/spaces', children, overlay }: PropsWithChildren<{ title: string; back?: Href; overlay?: React.ReactNode }>) {
  const router = useRouter();
  const s = useThemedStyles(createSpaceStyles);
  return <SafeAreaView style={s.screen}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="뒤로 가기" style={s.headerSide} onPress={() => router.replace(back)}><Text style={s.back}>‹</Text></Pressable><Text style={s.headerTitle}>{title}</Text><View style={s.headerSide} /></View>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>{children}</ScrollView>
      {overlay}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function SpaceButton({ children, onPress, disabled = false, kind = 'secondary' }: PropsWithChildren<{ onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'danger' | 'selected' }>) {
  const s = useThemedStyles(createSpaceStyles);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected: kind === 'selected' }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, kind === 'primary' && s.primary, kind === 'danger' && s.danger, kind === 'selected' && s.selected, (disabled || pressed) && s.faded]}>
    <Text style={[s.buttonText, kind === 'primary' && s.primaryText, kind === 'danger' && s.dangerText, kind === 'selected' && s.accentText]}>{children}</Text>
  </Pressable>;
}

export const createSpaceStyles = (palette: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  headerSide: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, back: { fontSize: 30, color: colors.text }, headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { padding: 20, paddingBottom: 40, gap: 20 }, eyebrow: { color: palette.primaryDark, fontSize: 12 }, title: { fontSize: 28, lineHeight: 38, fontWeight: '600', color: colors.text }, intro: { gap: 12, paddingVertical: 8 },
  heading: { fontSize: 18, fontWeight: '600', color: colors.text }, name: { fontSize: 16, fontWeight: '600', color: colors.text }, text: { color: colors.muted, fontSize: 14, lineHeight: 23 }, hint: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  card: { gap: 14, padding: 20, borderWidth: 1, borderColor: colors.border, borderRadius: 24, backgroundColor: colors.surface }, currentCard: { borderColor: palette.primary }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, grow: { flex: 1, gap: 4 },
  symbol: { width: 48, height: 48, borderRadius: 16, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' }, symbolText: { fontSize: 28, color: palette.primaryDark }, tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' }, tag: { backgroundColor: colors.surfaceMuted, color: colors.muted, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 },
  button: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }, buttonText: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' }, primary: { backgroundColor: palette.primary, borderColor: palette.primary }, primaryText: { color: '#FFFFFF' }, selected: { borderColor: palette.primary, backgroundColor: palette.primarySoft }, accentText: { color: palette.primaryDark }, danger: { borderColor: colors.danger }, dangerText: { color: colors.danger }, faded: { opacity: 0.5 },
  input: { minHeight: 52, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 14, fontSize: 16, color: colors.text, backgroundColor: colors.surface }, label: { fontSize: 14, color: colors.text, fontWeight: '600' },
  code: { fontSize: 24, fontWeight: '600', letterSpacing: 2, textAlign: 'center', paddingVertical: 20, borderRadius: 16, backgroundColor: colors.surfaceMuted, color: colors.text },
  member: { gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 14 }, avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.4)' }, dialog: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, gap: 16, maxHeight: '85%' },
});
