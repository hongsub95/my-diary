// 사용자 테마 색상 팔레트.
//
// 서버는 `theme_key`만 저장하고 실제 색상값은 모른다(docs/API_SPEC.md 3-U절).
// 색은 웹이 여기, 모바일이 mobile/src/shared/theme.ts에 각자 들고 있다. 서버에 색을
// 넣으면 두 플랫폼이 서로 다른 값을 갖게 되는 순간을 알 수 없게 된다.
//
// **테마가 바꾸는 것은 --color-primary 계열 4개뿐이다.** danger, 완료(orange),
// 요일(sunday/saturday), sage처럼 뜻이 고정된 색은 사용자 테마로 바뀌지 않는다
// (docs/DESIGN_SPEC.md 2.3절). 그 색들이 테마를 따라 움직이면 "빨간색은 위험"
// 같은 약속이 테마마다 달라진다.

export const DEFAULT_THEME_KEY = 'rose'

/**
 * 프리셋 팔레트.
 *
 * 키는 서버의 `SUPPORTED_THEME_KEYS`와 같아야 한다. 여기에만 있고 서버에 없는 키를
 * 고르면 저장할 때 422가 난다.
 *
 * 각 값은 CSS 변수 네 개에 그대로 들어간다.
 * - primary: 주요 버튼, 선택 상태, 링크, 포커스, 하단 탭 활성색
 * - hover: 눌림·호버 상태
 * - light: primary 계열의 옅은 배경
 * - text: 옅은 배경 위에 올라가는 강조 텍스트
 */
export const THEME_PALETTES = {
  rose: {
    label: '로즈',
    primary: '#CF526B',
    hover: '#B8425A',
    light: '#FBECEF',
    text: '#9F3149',
  },
  purple: {
    label: '퍼플',
    primary: '#8E5AA8',
    hover: '#77488F',
    light: '#F4EEF7',
    text: '#6B3D80',
  },
  emerald: {
    label: '에메랄드',
    primary: '#478062',
    hover: '#3A6C51',
    light: '#E9F2ED',
    text: '#2F5F45',
  },
  blue: {
    label: '블루',
    primary: '#47749E',
    hover: '#3A6187',
    light: '#EAF1F7',
    text: '#2F5A7D',
  },
  orange: {
    label: '오렌지',
    primary: '#A45F26',
    hover: '#8C4F1D',
    light: '#F7EDE2',
    text: '#7A4418',
  },
}

/** 화면에 보여줄 순서. 객체 키 순서에 기대지 않고 명시한다. 기본 테마가 맨 앞이다. */
export const THEME_KEYS = ['rose', 'purple', 'emerald', 'blue', 'orange']

/**
 * 팔레트를 찾는다. 모르는 키는 기본 팔레트로 대신한다.
 *
 * @param {string | null | undefined} key
 * @returns {{label: string, primary: string, hover: string, light: string, text: string}}
 *
 * 서버도 조회할 때 같은 보정을 하지만(app/users/models.py의 normalize_theme_key)
 * 여기서도 한 번 더 막는다. 로그아웃 상태처럼 서버를 거치지 않고 값이 비는 경우가 있다.
 */
export function getPalette(key) {
  return THEME_PALETTES[key] ?? THEME_PALETTES[DEFAULT_THEME_KEY]
}

/**
 * 테마를 화면에 적용한다.
 *
 * @param {string | null | undefined} key 적용할 테마 키. 없으면 기본 테마
 *
 * :root의 CSS 변수를 덮어쓰는 방식이라 이미 그려진 화면까지 즉시 바뀐다. 컴포넌트가
 * 색을 직접 들고 있지 않고 전부 변수를 참조하기 때문에 리렌더가 필요 없다.
 *
 * variables.css의 기본값은 로즈다. 그래서 로그아웃해서 키가 비면 인라인 값을 지워
 * 원래 스타일시트 값으로 돌아가게 한다 — 로즈를 다시 써넣지 않는 이유는, 나중에
 * 기본 팔레트를 바꿀 때 고쳐야 할 곳이 스타일시트 한 군데로 유지되기 때문이다.
 */
export function applyTheme(key) {
  const root = document.documentElement

  if (!key || key === DEFAULT_THEME_KEY) {
    root.style.removeProperty('--color-primary')
    root.style.removeProperty('--color-primary-hover')
    root.style.removeProperty('--color-primary-light')
    root.style.removeProperty('--color-primary-text')
    return
  }

  const palette = getPalette(key)
  root.style.setProperty('--color-primary', palette.primary)
  root.style.setProperty('--color-primary-hover', palette.hover)
  root.style.setProperty('--color-primary-light', palette.light)
  root.style.setProperty('--color-primary-text', palette.text)
}
