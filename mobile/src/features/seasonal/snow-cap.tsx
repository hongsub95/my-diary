import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { seededRandom } from './village';

/**
 * 카드 윗변에 쌓인 눈 모양. 가운데가 두툼하고 양 끝으로 갈수록 얇아져 사라진다.
 *
 * viewBox 300×12를 카드 폭에 맞춰 늘린다. 카드 폭이 달라도 둥근 덩어리 수는 같아서
 * 좁은 카드에서는 촘촘하고 넓은 카드에서는 넉넉해 보인다.
 */
const CAP_PATH = (() => {
  const random = seededRandom(3);
  const bumps = 12;
  const step = 300 / bumps;
  let d = 'M0 12 L0 11';
  for (let i = 0; i < bumps; i++) {
    const x0 = i * step;
    // 양 끝 덩어리는 낮게, 가운데는 높게
    const height = 2 + 5 * Math.sin((Math.PI * (i + 0.5)) / bumps) + random() * 1.5;
    const valley = i === bumps - 1 ? 11 : 7 + random() * 1.5;
    d += ` Q${(x0 + step / 2).toFixed(1)} ${(valley - height * 1.25).toFixed(1)} ${(x0 + step).toFixed(1)} ${valley.toFixed(1)}`;
  }
  return `${d} L300 12 Z`;
})();

/**
 * 눈 모양 하나. 부모의 맨 위에 절대 위치로 붙는다(위로 8px 올라온다).
 *
 * @param night 낮 하늘은 밝아서 흰 눈이 묻히므로 낮에만 옅은 윤곽선을 그린다
 *
 * 보통은 SnowCapped를 쓴다. 움직이는 판(홈 시트)처럼 바깥 틀로 감쌀 수 없을 때 판 안에 직접 넣는다.
 */
export function SnowCap({ night }: { night: boolean }) {
  return (
    <View pointerEvents="none" style={styles.cap}>
      <Svg width="100%" height={12} viewBox="0 0 300 12" preserveAspectRatio="none">
        <Path d={CAP_PATH} fill="#FFFFFF" stroke={night ? 'none' : 'rgba(90,115,150,0.35)'} strokeWidth={0.6} />
      </Svg>
    </View>
  );
}

/**
 * 카드 위에 눈을 얹는 바깥 틀. **카드 안은 건드리지 않는다.**
 *
 * @param show false면 틀만 남고 눈은 없다. 계절 배경이 꺼졌거나 이 화면이 대상이 아닐 때다
 * @param night 낮 하늘은 밝아서 흰 눈이 묻히므로 낮에만 옅은 윤곽선을 그린다
 * @param style 틀에 줄 바깥 여백. 카드에 marginTop이 있으면 이리로 옮겨야 눈이 카드
 *   윗변에 붙는다 (여백 안에 뜨지 않게)
 *
 * 카드가 overflow: hidden이어도 잘리지 않도록 카드 바깥 형제로 그린다.
 */
export function SnowCapped({ show, night, style, children }: PropsWithChildren<{ show: boolean; night: boolean; style?: StyleProp<ViewStyle> }>) {
  return (
    <View style={style}>
      {children}
      {show && <SnowCap night={night} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // 높이 12 중 아래 4px이 카드 윗변 안쪽으로 들어간다. 카드 안 여백(패딩) 위라 글씨에 닿지 않는다.
  cap: { height: 12, left: 14, position: 'absolute', right: 14, top: -8 },
});
