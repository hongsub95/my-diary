import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { updateProfile } from '../api/users'
import { christmasChipLabel, isNightScene, isSeasonActive } from './seasonRules'

const SeasonalContext = createContext(null)

/** 시각을 다시 읽는 간격. 자동일 때 18시가 넘으면 1분 안에 밤으로 바뀐다. */
const CLOCK_TICK_MS = 60_000

/**
 * 계절 배경 설정과 "지금 낮인지 밤인지"를 앱 전체에 공급한다.
 *
 * 테마와 같은 이유로 로그인 상태를 따라간다(ThemeSync.jsx). 설정은 계정에 저장돼
 * 웹과 앱이 같게 보이고, 로그아웃하면 기본값(켜짐·자동)으로 돌아간다.
 *
 * 시각은 1분마다, 그리고 탭이 다시 보일 때 새로 읽는다. 다른 탭에 오래 있다가
 * 돌아왔는데 낮 장면이 그대로 남아 있으면 안 된다.
 *
 * **AuthProvider 안에 둬야 한다.**
 */
export function SeasonalProvider({ children }) {
  const { user, updateUser } = useAuth()
  const [now, setNow] = useState(() => new Date())
  // 저장 전 미리보기. 저장이 끝나면(성공이든 실패든) 지운다. 남겨두면 다른 기기에서 바꾼
  // 값이 들어와도 이 값이 계속 이긴다.
  const [pendingEnabled, setPendingEnabled] = useState(null)
  const [pendingTime, setPendingTime] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(new Date()) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  const savedEnabled = user?.seasonal_background_enabled ?? true
  const savedTime = user?.seasonal_background_time ?? 'auto'

  /**
   * 켜기/끄기를 저장한다. 고르는 즉시 화면에 적용하고 실패하면 되돌린다.
   * @throws 저장 실패. 부른 쪽이 안내를 띄운다
   */
  const setEnabled = useCallback(async (value) => {
    setPendingEnabled(value)
    try {
      updateUser(await updateProfile({ seasonalBackgroundEnabled: value }))
    } finally {
      setPendingEnabled(null)
    }
  }, [updateUser])

  /** 낮·밤 선택을 저장한다. 규칙은 setEnabled와 같다. */
  const setTimeMode = useCallback(async (value) => {
    setPendingTime(value)
    try {
      updateUser(await updateProfile({ seasonalBackgroundTime: value }))
    } finally {
      setPendingTime(null)
    }
  }, [updateUser])

  const value = useMemo(() => {
    const inSeason = isSeasonActive(now)
    const enabled = pendingEnabled ?? savedEnabled
    const timeMode = pendingTime ?? savedTime
    return {
      inSeason,
      enabled,
      visible: inSeason && enabled,
      timeMode,
      night: isNightScene(now, timeMode),
      chipLabel: christmasChipLabel(now),
      setEnabled,
      setTimeMode,
    }
  }, [now, pendingEnabled, pendingTime, savedEnabled, savedTime, setEnabled, setTimeMode])

  return <SeasonalContext.Provider value={value}>{children}</SeasonalContext.Provider>
}

export function useSeasonal() {
  const value = useContext(SeasonalContext)
  if (!value) throw new Error('useSeasonal must be used inside SeasonalProvider')
  return value
}
