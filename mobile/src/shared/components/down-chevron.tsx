import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/shared/theme';

/**
 * "2026년 12월 ⌄"처럼 누르면 고르기가 열리는 제목 옆의 아래 화살표.
 *
 * @param size 아이콘 크기. 제목 글씨보다 조금 작게 쓴다
 * @param color 기본은 보조 글씨 색
 *
 * 글자 "⌄"는 글꼴 기준선에 붙어 제목보다 아래로 처져 보였다. 아이콘으로 그리고, 부모를
 * flexDirection: 'row', alignItems: 'center'로 두면 제목과 위아래 가운데가 맞는다.
 * 화면 읽기 도구에는 읽히지 않는다(버튼 이름에 "열기"가 이미 있다).
 */
export function DownChevron({ size = 14, color = colors.muted }: { size?: number; color?: string }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView
        name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
        size={size}
        tintColor={color}
        // 아이콘을 못 그리는 곳에서는 테두리 두 변으로 그린 ⌄. 45도 돌리면 아래로 내려가 보여서 살짝 끌어올린다.
        fallback={<View style={[styles.fallback, { width: size * 0.5, height: size * 0.5, borderColor: color }]} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { borderBottomWidth: 1.8, borderRightWidth: 1.8, marginTop: -3, transform: [{ rotate: '45deg' }] },
});
