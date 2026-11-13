// 골목 장면의 색. 하늘과 건물에 고른 테마 색이 살짝 섞인다 (시안 A "눈 오는 골목").
//
// 웹 시안은 CSS color-mix로 섞었는데 RN에는 없어서 같은 비율로 직접 섞는다.
// 카드·버튼 색은 여기서 정하지 않는다. 카드 안은 평소 테마 색 그대로다.

import type { ThemePalette } from '@/shared/theme';

/**
 * 두 색을 섞는다.
 *
 * @param a 섞을 색(#RRGGBB)
 * @param weight a의 비율(0~1). CSS `color-mix(in srgb, a weight, b)`와 같다
 * @param b 바탕 색(#RRGGBB)
 */
export function mix(a: string, weight: number, b: string): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const channel = (i: number) => Math.round(pa[i] * weight + pb[i] * (1 - weight)).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

function parseHex(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

export type SceneColors = {
  /** 하늘 그라데이션. 위에서 아래로 네 칸 */
  sky: [string, string, string, string];
  near: string;
  far: string;
  /** 테마 색이 섞인 전구 */
  bulbTheme: string;
  window: string;
  wire: string;
};

/** 탭 바 뒤로 이어지는 눈밭 색. 골목 땅의 맨 아래 색과 같아야 경계가 보이지 않는다. */
export const GROUND_BOTTOM = '#DFE6EF';

export function sceneColors(palette: ThemePalette, night: boolean): SceneColors {
  if (night) {
    return {
      sky: [
        mix(palette.primaryDark, 0.22, '#10162E'),
        mix(palette.primary, 0.16, '#252E55'),
        mix(palette.primary, 0.12, '#2F3A68'),
        mix(palette.primarySoft, 0.22, '#5F6D9A'),
      ],
      near: mix(palette.primaryDark, 0.16, '#151B36'),
      far: mix(palette.primary, 0.14, '#36406A'),
      bulbTheme: mix(palette.primary, 0.55, '#FFFFFF'),
      window: '#FFD27A',
      wire: '#0D1124',
    };
  }
  return {
    sky: [mix(palette.primarySoft, 0.25, '#B9CFE3'), '#D5E2EC', '#E4EBF0', '#EDF0F2'],
    near: mix(palette.primaryDark, 0.1, '#7D8BA0'),
    far: mix(palette.primary, 0.08, '#AEBBCB'),
    bulbTheme: mix(palette.primary, 0.55, '#FFFFFF'),
    window: '#E3ECF4',
    wire: '#5A6475',
  };
}

/** 밤하늘 위 카드 밖 글씨. 낮에는 평소 색을 쓰므로 밤일 때만 쓴다. */
export const NIGHT_TEXT = {
  strong: '#FFFFFF',
  muted: 'rgba(255,255,255,0.78)',
  accent: '#FFE2A0',
};

/**
 * 밤 글씨에 붙이는 은은한 그림자.
 *
 * 목록을 내리면 카드 밖 글씨가 달빛이나 화면 아래 흰 눈밭 위를 지나간다. 그때 흰 글씨가
 * 바탕에 묻히지 않게 한다. 어두운 하늘 위에서는 거의 보이지 않는다.
 */
export const NIGHT_TEXT_SHADOW = {
  textShadowColor: 'rgba(10,14,30,0.6)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};
