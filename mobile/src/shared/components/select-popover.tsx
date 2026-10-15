import { useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

const ROW_HEIGHT = 44;
const MAX_LIST_HEIGHT = ROW_HEIGHT * 6.5;
const GAP = 6;
type Anchor = { x: number; y: number; width: number; height: number };
export type SelectOption = { value: string; label: string; muted?: boolean };

export function SelectButton({ label, onPress, muted = false, open = false, disabled = false, accessibilityLabel }: {
  label: string; onPress: () => void; muted?: boolean; open?: boolean; disabled?: boolean; accessibilityLabel?: string;
}) {
  const styles = useThemedStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, open && styles.buttonOpen, pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={[styles.value, muted && styles.muted]}>{label}</Text>
    {/* 화살표를 글자(⌄)가 아니라 테두리 두 변으로 그린다. ⌄ 글자는 모양이 글자 줄 아래쪽에
        붙어 있어 칸 가운데에 두어도 밑으로 처져 보였다(2026-10-15 사용자 지적). */}
    <View style={styles.arrowBox}><View style={[styles.arrow, open && styles.arrowOpen]} /></View>
  </Pressable>;
}

// 투명 Modal은 안드로이드의 부모 밖 터치 제한을 피하는 용도다. 목록만 칸에 붙인다.
export function SelectPopover({ value, options, onChange, placeholder = '선택', disabled = false, accessibilityLabel }: {
  value: string; options: SelectOption[]; onChange: (value: string) => void;
  placeholder?: string; disabled?: boolean; accessibilityLabel?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const anchorRef = useRef<View>(null);
  const listRef = useRef<ScrollView>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const chosen = options.find(option => option.value === value);
  function toggle() {
    if (anchor) { setAnchor(null); return; }
    if (disabled) return;
    Keyboard.dismiss();
    anchorRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  }
  function revealSelected() {
    const index = options.findIndex(option => option.value === value);
    if (index >= 0) listRef.current?.scrollTo({ y: Math.max(0, (index - 2) * ROW_HEIGHT), animated: false });
  }
  const height = Math.min(MAX_LIST_HEIGHT, options.length * ROW_HEIGHT);
  const below = anchor ? Math.max(0, screen.height - insets.bottom - 16 - anchor.y - anchor.height - GAP) : 0;
  const above = anchor ? Math.max(0, anchor.y - insets.top - 16 - GAP) : 0;
  const position = anchor ? {
    left: Math.max(16, Math.min(anchor.x, screen.width - anchor.width - 16)),
    width: Math.min(anchor.width, screen.width - 32),
    ...(below >= height || below >= above
      ? { top: anchor.y + anchor.height + GAP, maxHeight: Math.min(height, below) }
      : { bottom: screen.height - anchor.y + GAP, maxHeight: Math.min(height, above) }),
  } : null;
  return <View>
    <View collapsable={false} ref={anchorRef}>
      <SelectButton label={chosen?.label ?? placeholder} muted={chosen?.muted ?? !chosen}
        open={!!anchor} disabled={disabled} onPress={toggle}
        accessibilityLabel={accessibilityLabel ? `${accessibilityLabel}, ${chosen?.label ?? placeholder}` : undefined} />
    </View>
    <Modal animationType="fade" transparent visible={!!anchor && !disabled} onRequestClose={() => setAnchor(null)}>
      <Pressable style={styles.backdrop} onPress={() => setAnchor(null)}>
        {position && <Pressable style={[styles.list, position]} onPress={() => {}}>
          <ScrollView ref={listRef} onLayout={revealSelected} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {options.map(option => <Pressable key={option.value} accessibilityRole="button"
              accessibilityState={{ selected: option.value === value }}
              onPress={() => { onChange(option.value); setAnchor(null); }}
              style={({ pressed }) => [styles.row, option.value === value && styles.rowSelected, pressed && styles.rowPressed]}>
              <Text numberOfLines={1} style={[styles.rowText, option.muted && styles.muted, option.value === value && styles.rowTextSelected]}>{option.label}</Text>
              {option.value === value && <Text style={styles.check}>✓</Text>}
            </Pressable>)}
          </ScrollView>
        </Pressable>}
      </Pressable>
    </Modal>
  </View>;
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingHorizontal: 14 },
  buttonOpen: { borderColor: palette.primary }, pressed: { opacity: 0.75 }, disabled: { opacity: 0.45 },
  value: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '600' }, muted: { color: colors.muted, fontWeight: '400' },
  // 정사각형의 오른쪽·아래 변만 그려 45° 돌리면 ∨ 모양이 된다. 돌린 모양의 무게중심이
  // 아래로 쏠리므로 위로 2px 올려 칸 가운데에 맞춘다. 열리면 반대로 돌려 ∧가 된다.
  arrowBox: { alignItems: 'center', height: 20, justifyContent: 'center', marginLeft: 8, width: 16 },
  arrow: { borderBottomWidth: 1.8, borderColor: colors.muted, borderRightWidth: 1.8, height: 8, transform: [{ translateY: -2 }, { rotate: '45deg' }], width: 8 },
  arrowOpen: { borderColor: palette.primary, transform: [{ translateY: 2 }, { rotate: '-135deg' }] },
  backdrop: { flex: 1 },
  list: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, elevation: 8, overflow: 'hidden', position: 'absolute', shadowColor: colors.text, shadowOffset: { height: 6, width: 0 }, shadowOpacity: 0.16, shadowRadius: 16 },
  row: { alignItems: 'center', flexDirection: 'row', height: ROW_HEIGHT, paddingHorizontal: 14 },
  rowSelected: { backgroundColor: palette.primarySoft }, rowPressed: { backgroundColor: colors.background },
  rowText: { color: colors.text, flex: 1, fontSize: 14 }, rowTextSelected: { color: palette.primaryDark, fontWeight: '600' }, check: { color: palette.primary, fontSize: 14, fontWeight: '600' },
});
