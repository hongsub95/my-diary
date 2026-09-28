import { useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, type ThemePalette } from '@/shared/theme';
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

// 한 줄 높이(px). 열 때 고른 값으로 스크롤을 옮기려면 줄 높이가 고정이어야 한다.
const ROW_HEIGHT = 44;
// 펼친 목록이 차지할 최대 높이. 여섯 줄 반쯤 보여서 "더 있다"가 잘린 줄로 읽힌다.
const MAX_LIST_HEIGHT = ROW_HEIGHT * 6.5;
// 고른 줄 위로 남겨 둘 줄 수. 맨 위에 딱 붙이면 앞뒤 맥락이 사라진다.
const ROWS_ABOVE_SELECTED = 2;
// 칸과 목록 사이 간격.
const LIST_GAP = 6;
// 화면 가장자리에 남겨 둘 여백. 이만큼도 안 남으면 반대쪽으로 펼친다.
const SCREEN_MARGIN = 16;

type Anchor = { x: number; y: number; width: number; height: number };

/**
 * 눌러서 여는 선택 버튼. 날짜와 시각이 같은 모양을 쓴다.
 *
 * @param label 지금 고른 값
 * @param onPress 누르면 할 일
 * @param muted 아직 고르지 않은 상태인지. 흐리게 보여 "빈 칸"임을 알린다
 * @param open 목록이 펼쳐져 있는지. 테두리와 화살표 방향이 달라진다
 */
export function SelectButton({
  label,
  onPress,
  muted = false,
  open = false,
}: {
  label: string;
  onPress: () => void;
  muted?: boolean;
  open?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectButton,
        open && styles.selectButtonOpen,
        pressed && styles.selectButtonPressed,
      ]}
    >
      <Text style={[styles.selectValue, muted && styles.selectPlaceholder]}>{label}</Text>
      <Text style={[styles.selectArrow, open && styles.selectArrowOpen]}>⌄</Text>
    </Pressable>
  );
}

/**
 * 시각 선택 드롭다운.
 *
 * @param value 지금 고른 `HH:MM`. 빈 문자열이면 고르지 않은 상태다
 * @param onChange 고른 값을 돌려준다. `clearable`이 켜져 있으면 빈 문자열도 올 수 있다
 * @param clearable 비울 수 있는지. 장소 예정시각처럼 없어도 되는 값에 켠다
 * @param placeholder 비었을 때 버튼에 보일 문구
 *
 * **목록은 칸 바로 아래에 뜨되 화면 위에 얹힌다.** 아래 내용을 밀지 않으니 펼치는
 * 순간 화면이 출렁이지 않고, 고치던 자리가 그대로 보인다.
 *
 * **Modal로 띄우는 이유는 안드로이드 때문이다.** 부모 영역 밖으로 나간 자식은 그려지긴
 * 해도 터치를 받지 못한다. 흐름 안에서 position:absolute로 띄우면 목록이 보이는데
 * 스크롤도 선택도 되지 않는다. Modal은 별도 창이라 그 제약을 받지 않는다.
 * 바텀시트처럼 화면을 덮지 않고, 잰 좌표에 맞춰 칸에 붙여 놓는다.
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
  const anchorRef = useRef<View>(null);
  const listRef = useRef<ScrollView>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  // 30분 눈금 밖의 값(예전에 다른 경로로 들어온 14:15)도 목록에 남긴다. 없으면 어디에도
  // 체크가 없어서, 고치지도 않았는데 시각이 지워진 것처럼 읽힌다.
  const times = !value || TIME_OPTIONS.includes(value) ? TIME_OPTIONS : [value, ...TIME_OPTIONS];
  const rows = clearable ? ['', ...times] : times;

  /**
   * 펼치거나 접는다.
   *
   * 펼치기 전에 칸이 화면 어디에 있는지 잰다. Modal은 화면 전체를 기준으로 그리므로,
   * 칸에 붙여 놓으려면 좌표를 알아야 한다.
   */
  const toggle = () => {
    if (anchor) {
      setAnchor(null);
      return;
    }
    anchorRef.current?.measureInWindow((x, y, width, height) =>
      setAnchor({ height, width, x, y }),
    );
  };

  const pick = (next: string) => {
    onChange(next);
    setAnchor(null);
  };

  /**
   * 펼칠 때 고른 값이 보이도록 스크롤을 옮긴다.
   *
   * 자정부터 시작하는 목록이라 그냥 열면 늘 00:00이 보인다. 오후 2시를 고쳐 놓고 다시
   * 열었는데 한밤중이 보이면, 값이 날아간 것처럼 읽힌다.
   */
  const revealSelected = () => {
    const index = rows.indexOf(value);
    if (index < 0) return;
    const offset = Math.max(0, (index - ROWS_ABOVE_SELECTED) * ROW_HEIGHT);
    listRef.current?.scrollTo({ y: offset, animated: false });
  };

  /**
   * 잰 좌표를 목록 위치로 바꾼다.
   *
   * 아래 공간이 모자라면 위로 펼친다. 떠 있는 목록은 스크롤로 따라갈 수 없어서, 화면
   * 밖으로 나가면 영영 못 본다.
   */
  const listPosition = () => {
    if (!anchor) return null;
    const screenHeight = Dimensions.get('window').height;
    const spaceBelow = screenHeight - (anchor.y + anchor.height) - SCREEN_MARGIN;
    const base = { left: anchor.x, width: anchor.width };

    if (spaceBelow >= MAX_LIST_HEIGHT || spaceBelow >= anchor.y) {
      return { ...base, maxHeight: Math.min(MAX_LIST_HEIGHT, spaceBelow), top: anchor.y + anchor.height + LIST_GAP };
    }
    return {
      ...base,
      bottom: screenHeight - anchor.y + LIST_GAP,
      maxHeight: Math.min(MAX_LIST_HEIGHT, anchor.y - SCREEN_MARGIN),
    };
  };

  const position = listPosition();

  return (
    <View>
      <View collapsable={false} ref={anchorRef}>
        <SelectButton
          label={value || placeholder}
          muted={!value}
          open={anchor !== null}
          onPress={toggle}
        />
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setAnchor(null)}
        transparent
        visible={anchor !== null}
      >
        {/* 바깥을 누르면 닫힌다. 흐름 안에 띄울 때는 둘 곳이 없던 동작이다. */}
        <Pressable onPress={() => setAnchor(null)} style={styles.backdrop}>
          {position ? (
            // 빈 손잡이다. RN의 터치 응답자는 하나에게만 가므로, 목록의 빈 자리를
            // 눌러도 뒤 배경이 받지 않고 여기서 멈춘다.
            <Pressable onPress={() => {}} style={[styles.list, position]}>
              <ScrollView
                ref={listRef}
                onLayout={revealSelected}
                showsVerticalScrollIndicator={false}
              >
                {rows.map((time) => {
                  const selected = time === value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={time || 'none'}
                      onPress={() => pick(time)}
                      style={({ pressed }) => [
                        styles.row,
                        selected && styles.rowSelected,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rowText,
                          !time && styles.rowTextNone,
                          selected && styles.rowTextSelected,
                        ]}
                      >
                        {time || placeholder}
                      </Text>
                      {selected ? <Text style={styles.rowCheck}>✓</Text> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  selectButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', minHeight: 52, paddingHorizontal: 14 },
  // 펼친 표시는 테두리와 화살표 방향으로만 한다. 바탕색까지 바꾸면 값이 아니라 칸
  // 자체가 달라진 것처럼 읽힌다.
  selectButtonOpen: { borderColor: palette.primary },
  selectButtonPressed: { opacity: 0.75 },
  selectValue: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '600' },
  selectPlaceholder: { color: colors.muted, fontWeight: '400' },
  selectArrow: { color: colors.muted, fontSize: 18, lineHeight: 22 },
  // RN에는 회전 없는 간단한 방법이 없어 글자를 뒤집는다. 같은 자리에서 방향만 바뀐다.
  selectArrowOpen: { color: palette.primary, transform: [{ rotate: '180deg' }] },

  // 색을 깔지 않는다. 바깥 터치를 받는 것이 전부이고, 고치던 화면은 그대로 보여야 한다.
  backdrop: { flex: 1 },
  list: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, elevation: 8, overflow: 'hidden', position: 'absolute', shadowColor: '#282321', shadowOffset: { height: 6, width: 0 }, shadowOpacity: 0.16, shadowRadius: 16 },

  row: { alignItems: 'center', flexDirection: 'row', height: ROW_HEIGHT, paddingHorizontal: 14 },
  rowSelected: { backgroundColor: palette.primarySoft },
  rowPressed: { backgroundColor: colors.background },
  rowText: { color: colors.text, flex: 1, fontSize: 14 },
  rowTextNone: { color: colors.muted },
  rowTextSelected: { color: palette.primaryDark, fontWeight: '600' },
  rowCheck: { color: palette.primary, fontSize: 14, fontWeight: '600' },
});
