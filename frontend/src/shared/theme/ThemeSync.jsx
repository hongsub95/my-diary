import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { applyTheme } from './palettes'

/**
 * 로그인한 사용자의 테마를 화면에 반영한다. 그리는 것은 없다.
 *
 * 테마는 계정에 저장되므로(docs/API_SPEC.md 3-U절) 화면이 아니라 로그인 상태를 따라야
 * 한다. 여기 한 곳에 모아두면 다음 세 가지가 저절로 맞는다.
 *
 * 1. 새로고침 — AuthContext가 /auth/me로 사용자를 복원하면 그 값으로 적용된다
 * 2. 다른 기기에서 바꾼 테마 — 다시 로그인하면 서버 값으로 따라온다
 * 3. 로그아웃 — user가 비면서 기본 로즈로 돌아간다
 *
 * 테마 선택 화면은 미리보기를 위해 applyTheme을 직접 부르지만, 저장에 성공하면
 * AuthContext의 사용자도 갱신되므로 결국 이 effect가 같은 값으로 다시 맞춘다.
 */
export default function ThemeSync() {
  const { user } = useAuth()
  const themeKey = user?.theme_key

  useEffect(() => {
    applyTheme(themeKey)
  }, [themeKey])

  return null
}
