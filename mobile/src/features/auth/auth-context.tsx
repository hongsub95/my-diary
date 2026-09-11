import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setUnauthorizedHandler } from '@/shared/api/auth-events';
import { tokenStore } from '@/shared/api/token-store';
import type { User } from '@/shared/api/types';
import * as authApi from './auth-api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  login: typeof authApi.login;
  register: typeof authApi.register;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  const becomeAnonymous = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(becomeAnonymous);
    return () => setUnauthorizedHandler(null);
  }, [becomeAnonymous]);

  useEffect(() => {
    async function bootstrap() {
      const refreshToken = await tokenStore.getRefreshToken();
      if (!refreshToken) {
        becomeAnonymous();
        return;
      }
      try {
        setUser(await authApi.getMe());
        setStatus('authenticated');
      } catch {
        await tokenStore.clear();
        becomeAnonymous();
      }
    }
    bootstrap();
  }, [becomeAnonymous]);

  const login = useCallback(async (input: authApi.LoginInput) => {
    const nextUser = await authApi.login(input);
    setUser(nextUser);
    setStatus('authenticated');
    return nextUser;
  }, []);

  const register = useCallback(async (input: authApi.RegisterInput) => {
    const nextUser = await authApi.register(input);
    setUser(nextUser);
    setStatus('authenticated');
    return nextUser;
  }, []);

  /**
   * 서버가 내려준 사용자 정보로 화면 상태를 갱신한다.
   *
   * @param nextUser `/auth/me`와 같은 형태의 사용자 객체
   *
   * 프로필을 고친 화면이 쓴다. 이걸 두지 않으면 닉네임을 바꾼 뒤에도 더보기 상단이
   * 옛 이름을 계속 보여주고, 앱을 다시 켜야 반영된다. setUser를 그대로 열지 않는
   * 이유는 화면이 임의의 값으로 로그인 상태를 만들지 못하게 하기 위해서다.
   */
  const updateUser = useCallback((nextUser: User) => {
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      becomeAnonymous();
    }
  }, [becomeAnonymous]);

  const value = useMemo(
    () => ({ status, user, login, register, logout, updateUser }),
    [status, user, login, register, logout, updateUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
