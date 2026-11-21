import { type PropsWithChildren, useEffect, useState } from 'react';
import { Animated, Easing, Keyboard, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/shared/theme';

type BottomSheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  /** 화면 읽기 도구가 읽을 시트 이름 */
  label: string;
  /** 시트 높이를 화면의 이 비율로 고정한다. 없으면 내용 높이만큼 */
  heightRatio?: number;
}>;

/**
 * 아래에서 올라오는 날짜 시트의 틀.
 *
 * 누른 자리 옆에 뜨던 팝오버를 대신한다. 늘 같은 자리(화면 아래)에서 올라와 엄지로 닿기
 * 쉽고, 화면 아래쪽 칸에서 열어도 위로 뒤집히지 않는다. 바깥(어두운 막)을 누르거나
 * 안드로이드 뒤로 가기를 누르면 닫힌다.
 */
export function BottomSheet({ visible, onClose, label, heightRatio, children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // 렌더 중에 ref를 읽지 않도록(React Compiler 규칙) 애니메이션 값은 state로 한 번만 만든다.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    Keyboard.dismiss();
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress, visible]);

  if (!visible) return null;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height * 0.4, 0] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.dim, { opacity: progress }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label} 닫기`} style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={label}
        onAccessibilityEscape={onClose}
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 12) + 10, transform: [{ translateY }] },
          heightRatio ? { height: height * heightRatio } : { maxHeight: height - insets.top - 24 },
        ]}>
        <View style={styles.grab} />
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(28,25,23,0.38)', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    bottom: 0,
    elevation: 16,
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  grab: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: 2, height: 4, marginBottom: 12, width: 42 },
});
