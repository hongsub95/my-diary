import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchMe, webLogin, webLogout, webRegister } from '../api/auth'

const AuthContext = createContext(null)

/**
 * 로그인 상태를 앱 전체에 공급한다.
 *
 * 상태는 세 가지다.
 * - loading  : 아직 확인 중. 이 동안 화면을 판단하면 안 된다
 * - authenticated / anonymous : 확인 끝
 *
 * loading을 따로 두는 이유: 세션 ID가 httpOnly 쿠키라 자바스크립트가 로그인 여부를
 * 즉시 알 수 없고, 서버에 한 번 물어봐야 한다. 그 사이를 '비로그인'으로 취급하면
 * 새로고침할 때마다 로그인 화면이 한 번 번쩍이고 원래 보던 페이지를 잃는다.
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)

  useEffect(() => {
    // 언마운트된 뒤에 응답이 도착해 상태를 건드리는 것을 막는다.
    let alive = true

    async function bootstrap() {
      try {
        const me = await fetchMe()
        if (alive) {
          setUser(me)
          setStatus('authenticated')
        }
      } catch {
        // 401뿐 아니라 서버가 꺼져 있는 경우도 여기로 온다. 어느 쪽이든 지금은
        // 로그인 상태가 아니므로 비로그인으로 두고, 실패 이유는 로그인 시도 시점에
        // 서버 문구로 보여준다.
        if (alive) {
          setUser(null)
          setStatus('anonymous')
        }
      }
    }

    bootstrap()
    return () => {
      alive = false
    }
  }, [])

  /**
   * 로그인한다. 실패하면 오류를 그대로 던지므로 호출하는 화면이 문구를 띄운다.
   *
   * @param {{email: string, password: string}} credentials
   */
  const login = useCallback(async (credentials) => {
    const me = await webLogin(credentials)
    setUser(me)
    setStatus('authenticated')
    return me
  }, [])

  /**
   * 회원가입한다. 성공하면 별도 로그인 없이 바로 로그인 상태가 된다.
   *
   * @param {{email: string, nickname: string, password: string}} form
   */
  const register = useCallback(async (form) => {
    const me = await webRegister(form)
    setUser(me)
    setStatus('authenticated')
    return me
  }, [])

  /** 로그아웃한다. 서버 호출이 실패해도 화면 상태는 반드시 비로그인으로 되돌린다. */
  const logout = useCallback(async () => {
    try {
      await webLogout()
    } finally {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다.')
  return value
}
