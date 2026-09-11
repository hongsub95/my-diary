import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/auth-context';
import {
  DEFAULT_THEME_KEY,
  getPalette,
  THEME_PALETTES,
  type ThemePalette,
} from '@/shared/theme';

type ThemeContextValue = {
  /** 지금 화면에 쓸 팔레트. 미리보기 중이면 미리보기 값이다. */
  palette: ThemePalette;
  /** 저장된 테마 키. "지금 계정에 무엇이 저장돼 있는지"를 보여줄 때 쓴다. */
  themeKey: string;
  /** 지금 화면에 실제로 적용된 키. 미리보기 중이면 미리보기 값이다. */
  activeKey: string;
  /** 미리보기 키를 세운다. null이면 저장된 값으로 돌아간다. */
  setPreviewKey: (key: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * 로그인한 사용자의 테마를 앱 전체에 공급한다.
 *
 * 테마는 계정에 저장되므로(docs/API_SPEC.md 3-U절) 화면이 아니라 로그인 상태를 따라야
 * 한다. 여기 한 곳에 모아두면 다음이 저절로 맞는다.
 *
 * 1. 앱 재시작 — auth-context가 /auth/me로 사용자를 복원하면 그 값이 쓰인다
 * 2. 다른 기기에서 바꾼 테마 — 다시 로그인하면 서버 값으로 따라온다
 * 3. 로그아웃 — user가 비면서 기본 로즈로 돌아간다
 *
 * **AuthProvider 안에 둬야 한다.** 사용자 정보를 읽기 때문이다.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  // 저장 전 미리보기. 테마 화면에서만 세우고, 저장에 성공하거나 실패하면 곧 지운다.
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const themeKey = user?.theme_key ?? null;

  const value = useMemo<ThemeContextValue>(
    () => ({
      palette: getPalette(previewKey ?? themeKey),
      // 모르는 키가 저장돼 있으면 화면에서도 기본 테마가 선택된 것으로 보여야 한다.
      // 그래야 선택 표시와 실제 색이 어긋나지 않는다.
      themeKey: normalizeKey(themeKey),
      activeKey: normalizeKey(previewKey ?? themeKey),
      setPreviewKey,
    }),
    [previewKey, themeKey],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** 지원하는 키로 맞춘다. 모르는 키는 기본 테마로 본다. */
function normalizeKey(key: string | null): string {
  return key && key in THEME_PALETTES ? key : DEFAULT_THEME_KEY;
}

/** 지금 쓸 팔레트를 가져온다. */
export function useTheme(): ThemePalette {
  return useThemeContext().palette;
}

/** 테마 화면이 쓰는 전체 값. 선택 상태 표시와 미리보기가 필요하다. */
export function useThemeContext(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

/**
 * 팔레트를 받아 스타일을 만드는 함수를 테마에 맞춰 실행한다.
 *
 * @param factory 모듈 최상위에 둔 스타일 생성 함수. 매 렌더 새로 만들면 memo가 무의미하다
 *
 * RN의 StyleSheet.create는 만들 때의 색을 그대로 들고 있어서, 모듈 최상위에서 한 번
 * 만들면 테마를 바꿔도 그 화면은 옛 색을 유지한다. 그래서 팔레트가 바뀔 때마다 다시
 * 만든다. 팔레트는 자주 바뀌지 않으므로 useMemo로 충분하다.
 */
export function useThemedStyles<T>(factory: (palette: ThemePalette) => T): T {
  const palette = useTheme();
  return useMemo(() => factory(palette), [factory, palette]);
}
