import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { seededRandom } from './village';

type FlakeSpec = { x: number; size: number; speed: number; alpha: number; start: number; sway: number; waves: number };

// 멀리(작고 느림)·중간·가까이(크고 빠름) 세 겹. 속도는 초당 px이다.
const LAYERS = [
  { count: 26, size: [1.6, 3], speed: [14, 24], alpha: 0.8 },
  { count: 16, size: [3.2, 5], speed: [24, 38], alpha: 0.9 },
  { count: 6, size: [5.6, 8], speed: [38, 54], alpha: 0.95 },
] as const;

type SnowfallProps = {
  width: number;
  height: number;
  /** false면 멈춘 장면만 그린다. 화면이 안 보이거나 "동작 줄이기"가 켜졌을 때다 */
  running: boolean;
  night: boolean;
};

/**
 * 카드 뒤로 내리는 눈.
 *
 * 송이마다 0→1로 도는 값 하나를 UI 스레드에서 돌리고, 그 값으로 세로 위치와 좌우
 * 흔들림을 함께 만든다. JS 스레드를 타지 않아 목록을 내리는 동안에도 끊기지 않는다.
 *
 * 낮 하늘은 밝아서 흰 눈이 묻히므로 낮에는 옅은 테두리를 둔다.
 */
export function Snowfall({ width, height, running, night }: SnowfallProps) {
  const flakes = useMemo<FlakeSpec[]>(() => {
    const random = seededRandom(7);
    const r = (a: number, b: number) => a + random() * (b - a);
    return LAYERS.flatMap(layer => Array.from({ length: layer.count }, () => ({
      x: r(0, width),
      size: r(layer.size[0], layer.size[1]),
      speed: r(layer.speed[0], layer.speed[1]),
      alpha: layer.alpha,
      start: random(),
      sway: r(3, 7),
      waves: r(1.5, 3),
    })));
  }, [width]);

  return (
    <>
      {flakes.map((flake, index) => (
        <Flake key={index} flake={flake} height={height} running={running} night={night} />
      ))}
    </>
  );
}

function Flake({ flake, height, running, night }: { flake: FlakeSpec; height: number; running: boolean; night: boolean }) {
  const progress = useSharedValue(flake.start);
  // 화면 위 -10px에서 아래 +10px까지 한 바퀴 내려오는 데 걸리는 시간
  const duration = ((height + 20) / flake.speed) * 1000;

  useEffect(() => {
    if (!running) {
      cancelAnimation(progress);
      return;
    }
    // 지금 자리에서 바닥까지 남은 만큼 먼저 내려오고, 그다음부터 위에서 다시 시작한다.
    // 모든 송이가 위에서 한꺼번에 출발하면 첫 몇 초 동안 화면 아래가 비어 보인다.
    const remaining = Math.max(0, 1 - progress.value) * duration;
    progress.value = withSequence(
      withTiming(1, { duration: remaining, easing: Easing.linear }),
      withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration, easing: Easing.linear })), -1),
    );
    return () => cancelAnimation(progress);
  }, [duration, progress, running]);

  const animated = useAnimatedStyle(() => ({
    transform: [
      { translateY: -10 + progress.value * (height + 20) },
      { translateX: Math.sin(progress.value * flake.waves * 2 * Math.PI) * flake.sway },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.flake,
        !night && styles.flakeDay,
        { left: flake.x, width: flake.size, height: flake.size, borderRadius: flake.size / 2, opacity: flake.alpha },
        animated,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  flake: { backgroundColor: '#FFFFFF', position: 'absolute', shadowColor: '#6E87A5', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.55, shadowRadius: 2, top: 0 },
  flakeDay: { borderColor: 'rgba(110,135,165,0.45)', borderWidth: 0.5 },
});
