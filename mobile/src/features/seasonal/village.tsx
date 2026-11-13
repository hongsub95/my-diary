import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { SceneColors } from './scene-colors';

/**
 * 시드가 있는 난수. 같은 시드면 늘 같은 골목이 나온다.
 *
 * Math.random을 쓰면 화면을 다시 그릴 때마다 건물 배치가 바뀌어 깜빡이는 것처럼 보인다.
 */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f1 = (n: number) => Number(n.toFixed(1));

type VillageOptions = {
  seed: number;
  /** 가까운 건물이 땅에 닿는 y (viewBox 0 0 370 H 기준) */
  base: number;
  /** 땅 모양 path */
  ground: string;
  /** 땅을 채울 그라데이션 id. 부모 Svg의 Defs에 있어야 한다 */
  groundFill: string;
  colors: SceneColors;
  night: boolean;
};

/**
 * 눈 덮인 골목 한 줄을 그린다. 웹 시안의 village()를 그대로 옮겼다.
 *
 * 먼 건물 → 가까운 건물(박공·평지붕, 지붕 위 눈, 창문, 오른쪽 첨탑 하나) → 땅 → 창 불빛이
 * 번진 눈 → 침엽수 순서로 겹친다. 낮에는 창 불빛과 번진 빛을 끈다.
 *
 * @returns Svg 안에 바로 넣을 요소 목록
 */
export function renderVillage({ seed, base, ground, groundFill, colors, night }: VillageOptions): ReactElement[] {
  const random = seededRandom(seed);
  const r = (a: number, b: number) => a + random() * (b - a);
  const out: ReactElement[] = [];
  let key = 0;
  const k = () => `v${key++}`;

  // 먼 건물: 낮은 대비, 창 몇 개만
  let x = -6;
  while (x < 376) {
    const w = r(30, 54);
    const h = r(30, 48);
    const top = base - 6 - h;
    out.push(<Rect key={k()} x={f1(x)} y={f1(top)} width={f1(w)} height={f1(h)} fill={colors.far} />);
    for (let i = 0; i < 3; i++) {
      if (random() < 0.5) {
        out.push(<Rect key={k()} x={f1(x + r(4, w - 8))} y={f1(top + r(6, h - 10))} width={3.5} height={4.5} fill="#FFE2A0" opacity={night ? 0.55 : 0.12} />);
      }
    }
    x += w + r(-4, 2);
  }

  // 가까운 건물
  const pools: ReactElement[] = [];
  let church = false;
  x = -4;
  while (x < 376) {
    if (!church && x > 258) {
      const cx = x + 2;
      out.push(
        <G key={k()}>
          <Rect x={f1(cx)} y={base - 46} width={26} height={46} fill={colors.near} />
          <Rect x={f1(cx + 7)} y={base - 72} width={12} height={28} fill={colors.near} />
          <Path d={`M${f1(cx + 4)} ${base - 72} L${f1(cx + 13)} ${base - 94} L${f1(cx + 22)} ${base - 72} Z`} fill={colors.near} />
          <Path d={`M${f1(cx + 13)} ${base - 101} v7 M${f1(cx + 10.5)} ${base - 98.5} h5`} stroke="#E9D9A8" strokeWidth={1.2} strokeLinecap="round" />
          <Path d={`M${f1(cx + 4.5)} ${base - 72.5} L${f1(cx + 13)} ${base - 92} L${f1(cx + 21.5)} ${base - 72.5}`} fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinejoin="round" opacity={0.9} />
          <Rect x={f1(cx)} y={base - 47.5} width={26} height={2.5} rx={1.2} fill="#FFFFFF" />
          <Circle cx={f1(cx + 13)} cy={base - 58} r={3.4} fill={colors.window} />
          <Path d={`M${f1(cx + 9)} ${base} v-12 a4 4 0 0 1 8 0 v12 Z`} fill={colors.window} />
        </G>,
      );
      pools.push(<Ellipse key={k()} cx={f1(cx + 13)} cy={base + 3} rx={30} ry={7} fill="url(#warmPool)" />);
      x += 30;
      church = true;
      continue;
    }
    const w = r(28, 46);
    const h = r(18, 36);
    const top = base - h;
    const gable = random() < 0.6;
    out.push(<Rect key={k()} x={f1(x)} y={f1(top)} width={f1(w)} height={f1(h)} fill={colors.near} />);
    if (gable) {
      const peak = top - w * 0.36;
      out.push(<Path key={k()} d={`M${f1(x - 2)} ${f1(top)} L${f1(x + w / 2)} ${f1(peak)} L${f1(x + w + 2)} ${f1(top)} Z`} fill={colors.near} />);
      out.push(<Path key={k()} d={`M${f1(x - 1)} ${f1(top - 0.5)} L${f1(x + w / 2)} ${f1(peak + 0.5)} L${f1(x + w + 1)} ${f1(top - 0.5)}`} fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" opacity={0.95} />);
    } else {
      out.push(<Rect key={k()} x={f1(x - 1)} y={f1(top - 1.5)} width={f1(w + 2)} height={3} rx={1.5} fill="#FFFFFF" />);
    }
    const cols = Math.floor((w - 6) / 9);
    const rows = Math.floor((h - 6) / 11);
    let lit = 0;
    for (let c = 0; c < cols; c++) {
      for (let row = 0; row < rows; row++) {
        const on = random() < 0.5;
        if (on) lit++;
        out.push(
          <Rect key={k()} x={f1(x + 5 + c * 9)} y={f1(top + 6 + row * 11)} width={4.5} height={6} rx={0.6}
            fill={on ? colors.window : '#FFFFFF'} opacity={on ? 1 : 0.07} />,
        );
      }
    }
    if (lit >= 2) pools.push(<Ellipse key={k()} cx={f1(x + w / 2)} cy={base + 2} rx={f1(w * 0.7)} ry={6} fill="url(#warmPool)" />);
    x += w + r(1, 5);
  }

  out.push(<Path key={k()} d={ground} fill={`url(#${groundFill})`} />);
  if (night) out.push(...pools);

  const pine = (px: number, by: number, h: number) => (
    <G key={k()}>
      <Path d={`M${px} ${by - h} L${f1(px - h * 0.3)} ${f1(by - h * 0.45)} H${f1(px - h * 0.16)} L${f1(px - h * 0.4)} ${by} H${f1(px + h * 0.4)} L${f1(px + h * 0.16)} ${f1(by - h * 0.45)} H${f1(px + h * 0.3)} Z`} fill="#2E4A3C" />
      <Path d={`M${f1(px - h * 0.3)} ${f1(by - h * 0.45)} L${px} ${by - h} L${f1(px + h * 0.3)} ${f1(by - h * 0.45)} M${f1(px - h * 0.4)} ${by} L${f1(px - h * 0.16)} ${f1(by - h * 0.45)} M${f1(px + h * 0.4)} ${by} L${f1(px + h * 0.16)} ${f1(by - h * 0.45)}`} fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" opacity={0.9} />
    </G>
  );
  out.push(pine(20, base + 2, 30), pine(44, base + 4, 20), pine(352, base, 28));
  return out;
}
