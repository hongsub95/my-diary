// 색과 간격의 단일 기준.
//
// **primary 계열은 여기 없다.** 사용자가 고른 테마에 따라 바뀌기 때문에 theme-context의
// useTheme()으로 가져와야 한다(docs/DESIGN_SPEC.md 2.3절). 정적으로 두면 RN이
// StyleSheet.create 시점의 값을 그대로 구워버려서 테마를 바꿔도 화면이 안 바뀐다.
//
// 반대로 여기 있는 색은 뜻이 고정된 색이다. danger, orange(완료), sage는 테마를 따라
// 움직이면 "빨간색은 위험" 같은 약속이 테마마다 달라진다.
export const colors = {
  background: '#F4F0EB',
  surface: '#FFFDF9',
  text: '#282321',
  muted: '#756D68',
  border: '#E9E2DC',
  ink: '#302927',
  sage: '#6C8069',
  // 기록 대기 표시용. 웹의 --color-orange와 같은 값이다.
  orange: '#B7773F',
  sand: '#E9E1D6',
  danger: '#D64545',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  xxl: 40,
};

/** 테마 하나가 제공하는 색. 웹의 CSS 변수 네 개 중 hover를 뺀 셋과 같은 값이다. */
export type ThemePalette = {
  label: string;
  /** 주요 버튼, 선택 상태, 포커스, 하단 탭 활성색 */
  primary: string;
  /** 옅은 배경 위에 올라가는 강조 텍스트 */
  primaryDark: string;
  /** primary 계열의 옅은 배경 */
  primarySoft: string;
};

export const DEFAULT_THEME_KEY = 'rose';

/**
 * 프리셋 팔레트.
 *
 * 키는 서버의 `SUPPORTED_THEME_KEYS`(app/users/models.py), 색은 웹의
 * frontend/src/shared/theme/palettes.js와 같아야 한다. 같은 계정이 웹과 앱에서 다른
 * 색을 보면 안 된다.
 *
 * 흰 글자를 올리는 버튼이 많아 primary는 흰색 대비 4.5:1을 기준으로 골랐다.
 * 기본값인 rose만 기존 브랜드 색을 유지하느라 4.14다.
 */
export const THEME_PALETTES: Record<string, ThemePalette> = {
  rose: { label: '로즈', primary: '#CF526B', primaryDark: '#9F3149', primarySoft: '#FBECEF' },
  purple: { label: '퍼플', primary: '#8E5AA8', primaryDark: '#6B3D80', primarySoft: '#F4EEF7' },
  emerald: { label: '에메랄드', primary: '#478062', primaryDark: '#2F5F45', primarySoft: '#E9F2ED' },
  blue: { label: '블루', primary: '#47749E', primaryDark: '#2F5A7D', primarySoft: '#EAF1F7' },
  orange: { label: '오렌지', primary: '#A45F26', primaryDark: '#7A4418', primarySoft: '#F7EDE2' },
};

/** 화면에 보여줄 순서. 객체 키 순서에 기대지 않고 명시한다. 기본 테마가 맨 앞이다. */
export const THEME_KEYS = ['rose', 'purple', 'emerald', 'blue', 'orange'];

/**
 * 팔레트를 찾는다. 모르는 키는 기본 팔레트로 대신한다.
 *
 * 서버도 조회할 때 같은 보정을 하지만(app/users/models.py의 normalize_theme_key)
 * 여기서도 한 번 더 막는다. 로그인 전처럼 서버를 거치지 않고 값이 비는 경우가 있다.
 */
export function getPalette(key: string | null | undefined): ThemePalette {
  return THEME_PALETTES[key ?? ''] ?? THEME_PALETTES[DEFAULT_THEME_KEY];
}
