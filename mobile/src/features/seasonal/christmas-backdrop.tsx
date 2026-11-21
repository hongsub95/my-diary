import { useIsFocused } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withRepeat, withTiming, cancelAnimation, Easing } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/shared/theme-context';
import { GROUND_BOTTOM, sceneColors, type SceneColors } from './scene-colors';
import { Snowfall } from './snowfall';
import { renderVillage, seededRandom } from './village';

const AnimatedG = Animated.createAnimatedComponent(G);

/**
 * 크리스마스 배경 A "눈 오는 골목"의 화면 전체 장면. 화면 뒤에 고정으로 깔린다.
 *
 * 위에서부터 하늘(그라데이션) → 전구 줄·달(해)·별(구름) → 화면 아래 골목 → 내리는 눈.
 * 목록을 내려도 움직이지 않고 카드만 올라간다 (docs/API_SPEC.md 3-U절 화면 규칙).
 *
 * @param night 밤 장면인지. 낮에는 해·구름이 뜨고 별·달·창 불빛이 꺼진다
 *
 * 눈과 전구 반짝임은 화면이 보일 때만 돈다. 탭은 화면을 떠나도 마운트된 채로 남아서,
 * 멈추지 않으면 안 보이는 탭 다섯 개가 함께 배터리를 쓴다. 기기의 "동작 줄이기"가
 * 켜져 있으면 처음부터 멈춘 장면만 그린다.
 */
export function ChristmasBackdrop({ night, variant = 'full' }: { night: boolean; variant?: 'full' | 'head' }) {
  const palette = useTheme();
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const colors = useMemo(() => sceneColors(palette, night), [palette, night]);
  const running = focused && !reduceMotion;

  return (
    <View
      testID={`seasonal-backdrop-${variant}`}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.sky[0] }]}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) setSize({ width, height });
      }}>
      {size.width > 0 && (
        <>
          <Sky width={size.width} height={size.height} colors={colors} night={night} head={variant === 'head'} />
          <TopScene width={size.width} colors={colors} night={night} running={running} />
          {variant === 'full' ? <BottomVillage width={size.width} colors={colors} night={night} /> : <SnowBank night={night} />}
          <Snowfall width={size.width} height={size.height} running={running} night={night} />
        </>
      )}
    </View>
  );
}

/** 하늘 그라데이션과 화면 가운데 별. 밤에는 지평선이 따뜻하게, 낮에는 오른쪽 위가 햇빛으로 밝다. */
const Sky = memo(function Sky({ width, height, colors, night, head }: { width: number; height: number; colors: SceneColors; night: boolean; head: boolean }) {
  const stars = useMemo(() => {
    if (!night || head) return [];
    const random = seededRandom(23);
    return Array.from({ length: 30 }, (_, i) => (
      <Circle key={i} cx={random() * width} cy={270 + random() * Math.max(0, height - 470)} r={0.5 + random() * 0.8} fill="#FFFFFF" opacity={0.6 + random() * 0.4} />
    ));
  }, [head, height, night, width]);

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          {/* 머리말 하늘은 짧아서 위 세 칸만 쓴다. SVG 자식에는 Stop 요소만 전달한다. */}
          {(head
            ? [['0', colors.sky[0]], ['0.55', colors.sky[1]], ['1', colors.sky[2]]]
            : [['0', colors.sky[0]], [String(Math.min(0.6, 260 / height)), colors.sky[1]], ['0.68', colors.sky[2]], ['1', colors.sky[3]]]
          ).map(([offset, color]) => <Stop key={offset} offset={offset} stopColor={color} />)}
        </LinearGradient>
        <RadialGradient id="glow" cx={night ? '50%' : '88%'} cy={night ? '100%' : '14%'} rx={night ? '65%' : '60%'} ry={night ? '13%' : '15%'}>
          <Stop offset="0" stopColor={night ? '#FFCD8C' : '#FFF3C8'} stopOpacity={night ? 0.32 : 0.6} />
          <Stop offset="1" stopColor={night ? '#FFCD8C' : '#FFF3C8'} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill="url(#sky)" />
      {!(head && night) && <Rect width={width} height={height} fill="url(#glow)" />}
      {stars}
    </Svg>
  );
});

// 전구 줄: 두 번 늘어진 곡선 (viewBox 0 0 370 270).
// 웹 시안보다 얕게 매달았다. 상태 바가 얇은 안드로이드(24dp)에서도 인사 글씨(상태 바
// 아래 20~28px)에 닿지 않도록 가장 낮은 전구 끝을 y≈36에 맞췄다.
const WIRE = 'M-10 4 Q 90 42 188 6 Q 284 38 380 2';
const BULB_COLORS = ['#FFD27A', 'theme', '#9FE3C9', '#A9D4FF'];

function swag(p0: number[], p1: number[], p2: number[], count: number, offset: number) {
  return Array.from({ length: count }, (_, k) => {
    const t = (k + 1) / (count + 1);
    const u = 1 - t;
    return {
      x: u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      y: u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
      index: offset + k + 1,
    };
  });
}
const BULBS = [...swag([-10, 4], [90, 42], [188, 6], 8, 0), ...swag([188, 6], [284, 38], [380, 2], 8, 8)];

/** 맨 위 전구 줄, 달·해, 별·빛망울·구름. 밤에는 전구 빛무리가 두 무리로 엇갈려 반짝인다. */
const TopScene = memo(function TopScene({ width, colors, night, running }: { width: number; colors: SceneColors; night: boolean; running: boolean }) {
  const phase = useSharedValue(1);
  useEffect(() => {
    if (!running || !night) {
      cancelAnimation(phase);
      phase.value = 1;
      return;
    }
    phase.value = withRepeat(withTiming(0.25, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(phase);
  }, [night, phase, running]);
  const haloA = useAnimatedProps(() => ({ opacity: phase.value }));
  const haloB = useAnimatedProps(() => ({ opacity: 1.25 - phase.value }));

  const random = seededRandom(11);
  const stars = night
    ? Array.from({ length: 28 }, (_, i) => <Circle key={i} cx={random() * 366 + 4} cy={58 + random() * 92} r={0.5 + random() * 0.8} fill="#FFFFFF" />)
    : [];
  const bulbFill = (i: number) => (BULB_COLORS[i % 4] === 'theme' ? colors.bulbTheme : BULB_COLORS[i % 4]);
  const bulbRotation = seededRandom(5);

  return (
    <Svg width={width} height={270} viewBox="0 0 370 270" preserveAspectRatio="xMidYMin slice" style={styles.top}>
      <Defs>
        <RadialGradient id="moonGlow"><Stop offset="0" stopColor="#FFF1CF" stopOpacity={0.55} /><Stop offset="1" stopColor="#FFF1CF" stopOpacity={0} /></RadialGradient>
        <RadialGradient id="sunGlow"><Stop offset="0" stopColor="#FFF3C8" stopOpacity={0.85} /><Stop offset="1" stopColor="#FFF3C8" stopOpacity={0} /></RadialGradient>
        <RadialGradient id="bokeh"><Stop offset="0" stopColor="#FFD682" stopOpacity={0.7} /><Stop offset="0.45" stopColor="#FFD682" stopOpacity={0.22} /><Stop offset="1" stopColor="#FFD682" stopOpacity={0} /></RadialGradient>
        <RadialGradient id="cloud"><Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} /><Stop offset="0.6" stopColor="#FFFFFF" stopOpacity={0.55} /><Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} /></RadialGradient>
      </Defs>

      {night ? (
        <G>
          {stars}
          {[[212, 66, 13], [262, 104, 8], [186, 132, 17], [300, 150, 11], [120, 156, 9], [240, 160, 6], [352, 72, 7]].map(([cx, cy, rr], i) => (
            <Circle key={`b${i}`} cx={cx} cy={cy} r={rr} fill="url(#bokeh)" />
          ))}
          <Circle cx={338} cy={132} r={28} fill="url(#moonGlow)" />
          <Circle cx={338} cy={132} r={10} fill="#FFF4DA" />
          <Circle cx={335} cy={129} r={2} fill="#F0E2BF" />
          <Circle cx={341} cy={135} r={1.4} fill="#F0E2BF" />
        </G>
      ) : (
        <G>
          <Circle cx={302} cy={152} r={44} fill="url(#sunGlow)" />
          <Circle cx={302} cy={152} r={13} fill="#FFF8E6" />
          <Ellipse cx={262} cy={140} rx={40} ry={11} fill="url(#cloud)" />
          <Ellipse cx={238} cy={133} rx={24} ry={12} fill="url(#cloud)" />
          <Ellipse cx={214} cy={78} rx={36} ry={9} fill="url(#cloud)" />
          <Ellipse cx={352} cy={164} rx={32} ry={9} fill="url(#cloud)" />
        </G>
      )}

      <Path d={WIRE} fill="none" stroke={colors.wire} strokeWidth={1.3} />
      {night && (
        <>
          <AnimatedG animatedProps={haloA}>
            {BULBS.filter(b => b.index % 2 === 0).map(b => <Circle key={b.index} cx={b.x} cy={b.y + 6} r={7} fill={bulbFill(b.index)} opacity={0.35} />)}
          </AnimatedG>
          <AnimatedG animatedProps={haloB}>
            {BULBS.filter(b => b.index % 2 === 1).map(b => <Circle key={b.index} cx={b.x} cy={b.y + 6} r={7} fill={bulbFill(b.index)} opacity={0.35} />)}
          </AnimatedG>
        </>
      )}
      <G opacity={night ? 1 : 0.85}>
        {BULBS.map(b => (
          <G key={b.index} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${(bulbRotation() * 28 - 14).toFixed(1)})`}>
            <Rect x={-1.6} y={-1} width={3.2} height={3} rx={0.6} fill="#2A2F45" />
            <Ellipse cy={5.6} rx={2.6} ry={3.8} fill={bulbFill(b.index)} />
            <Ellipse cx={-0.8} cy={4.4} rx={0.8} ry={1.3} fill="#FFFFFF" opacity={0.7} />
          </G>
        ))}
      </G>
    </Svg>
  );
});

/** 화면 아래, 탭 바 바로 위의 골목. 땅의 맨 아래 색이 탭 바 뒤 눈밭 색과 이어진다. */
const BottomVillage = memo(function BottomVillage({ width, colors, night }: { width: number; colors: SceneColors; night: boolean }) {
  const village = useMemo(
    () => renderVillage({ seed: 31, base: 128, ground: 'M0 122 Q 95 110 190 120 T 370 116 V 200 H 0 Z', groundFill: 'ground', colors, night }),
    [colors, night],
  );
  return (
    <Svg width={width} height={200} viewBox="0 0 370 200" preserveAspectRatio="xMidYMax slice" style={styles.bottom}>
      <Defs>
        <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.5" stopColor="#EEF2F7" />
          <Stop offset="1" stopColor={GROUND_BOTTOM} />
        </LinearGradient>
        <RadialGradient id="warmPool"><Stop offset="0" stopColor="#FFD27A" stopOpacity={0.45} /><Stop offset="1" stopColor="#FFD27A" stopOpacity={0} /></RadialGradient>
      </Defs>
      {village}
    </Svg>
  );
});

/**
 * 머리말 하늘의 아랫단 눈 둔덕. 하늘이 지도와 맞닿는 곳을 곧은 선 대신 눈 쌓인 물결로 끝낸다.
 */
function SnowBank({ night }: { night: boolean }) {
  return (
    <View style={styles.bank}>
      <Svg width="100%" height={16} viewBox="0 0 300 16" preserveAspectRatio="none">
        <Path d="M0 16 V9 Q 20 4 40 8 T 80 7 T 120 9 T 160 6 T 200 8 T 240 7 T 280 9 T 300 8 V16 Z" fill="#FFFFFF" stroke={night ? 'none' : 'rgba(90,115,150,0.3)'} strokeWidth={0.6} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { left: 0, position: 'absolute', top: 0 },
  bank: { bottom: 0, height: 16, left: 0, position: 'absolute', right: 0 },
  bottom: { bottom: 0, left: 0, position: 'absolute' },
});
