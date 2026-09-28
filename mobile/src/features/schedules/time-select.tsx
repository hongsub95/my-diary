import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, type ThemePalette } from '@/shared/theme';
import { useThemedStyles } from '@/shared/theme-context';

/** `HH:MM` 한 칸을 받아들이는 형식. 하루의 시작·종료 시간 검증에 쓴다. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * 30분 간격 시각 목록 (`HH:MM`).
 *
 * 하루의 시작·종료 시간과 장소 예정시각이 같은 눈금을 쓴다. 한쪽만 분 단위로 열어 두면
 * "2시 15분"과 "2시 30분"이 섞여 목록에서 시간 순서를 읽기 어려워진다.
 * 웹의 shared/utils/time.js와 같은 값이다.
 */
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  const minutes = index % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}`;
});

/**
 * 눌러서 여는 선택 버튼. 날짜와 시각이 같은 모양을 쓴다.
 *
 * @param label 지금 고른 값
 * @param onPress 시트를 여는 동작
 */
export function SelectButton({
  label,
  onPress,
  muted = false,
}: {
  label: string;
  onPress: () => void;
  /** 아직 고르지 않은 상태인지. 흐리게 보여 "빈 칸"임을 알린다 */
  muted?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.selectButton}>
      <Text style={[styles.selectValue, muted && styles.selectPlaceholder]}>{label}</Text>
      <Text style={styles.selectArrow}>⌄</Text>
    </Pressable>
  );
}

/**
 * 시각 선택 시트.
 *
 * @param value 지금 고른 `HH:MM`. 빈 문자열이면 고르지 않은 상태다
 * @param onChange 고른 값을 돌려준다. `clearable`이 켜져 있으면 빈 문자열도 올 수 있다
 * @param clearable 비울 수 있는지. 장소 예정시각처럼 없어도 되는 값에 켠다
 * @param placeholder 비었을 때 버튼에 보일 문구
 *
 * 기기 기본 시간 선택기를 쓰지 않는 이유: OS마다 모양과 조작이 달라 안드로이드와 iOS의
 * 화면이 갈리고, 웹의 30분 눈금과도 어긋난다. 목록으로 두면 세 화면이 같아진다.
 */
export function TimeSelect({
  value,
  onChange,
  clearable = false,
  placeholder = '시각 없음',
}: {
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
  placeholder?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const [visible, setVisible] = useState(false);

  // 30분 눈금 밖의 값(예전에 다른 경로로 들어온 14:15)도 목록에 남긴다. 없으면 어디에도
  // 체크가 없어서, 고치지도 않았는데 시각이 지워진 것처럼 읽힌다.
  const options = !value || TIME_OPTIONS.includes(value) ? TIME_OPTIONS : [value, ...TIME_OPTIONS];

  const pick = (next: string) => {
    onChange(next);
    setVisible(false);
  };

  return (
    <>
      <SelectButton label={value || placeholder} muted={!value} onPress={() => setVisible(true)} />
      <Modal animationType="slide" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <Pressable onPress={() => setVisible(false)} style={styles.modalBackdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.timeSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>시간 선택</Text>
              <Pressable accessibilityLabel="시간 선택 닫기" onPress={() => setVisible(false)}>
                <Text style={styles.sheetClose}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.timeGrid} showsVerticalScrollIndicator={false}>
              {clearable ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => pick('')}
                  style={[styles.timeOption, !value && styles.timeOptionSelected]}
                >
                  <Text style={[styles.timeOptionText, !value && styles.timeOptionTextSelected]}>
                    {placeholder}
                  </Text>
                  {!value ? <Text style={styles.timeOptionCheck}>✓</Text> : null}
                </Pressable>
              ) : null}
              {options.map((time) => (
                <Pressable
                  accessibilityRole="button"
                  key={time}
                  onPress={() => pick(time)}
                  style={[styles.timeOption, value === time && styles.timeOptionSelected]}
                >
                  <Text style={[styles.timeOptionText, value === time && styles.timeOptionTextSelected]}>
                    {time}
                  </Text>
                  {value === time ? <Text style={styles.timeOptionCheck}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  selectButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingHorizontal: 14 },
  selectValue: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '600' },
  selectPlaceholder: { color: colors.muted, fontWeight: '400' },
  selectArrow: { color: colors.muted, fontSize: 18 },

  modalBackdrop: { backgroundColor: 'rgba(40, 35, 33, 0.38)', flex: 1, justifyContent: 'flex-end' },
  timeSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '72%', paddingBottom: 24, paddingHorizontal: spacing.lg, paddingTop: 10 },
  sheetHeader: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 4 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '600' },
  sheetClose: { color: colors.muted, fontSize: 28, padding: 8 },
  timeGrid: { gap: 6, paddingTop: 12 },
  timeOption: { alignItems: 'center', borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', minHeight: 48, paddingHorizontal: 16 },
  timeOptionSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  timeOptionText: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '600' },
  timeOptionTextSelected: { color: '#FFFFFF' },
  timeOptionCheck: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
