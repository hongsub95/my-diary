import { apiClient } from '@/shared/api/client';
import { tokenStore } from '@/shared/api/token-store';
import type { RegisterResponse, TokenPair, User } from '@/shared/api/types';

export type LoginInput = { email: string; password: string };
/** 가입 시 받아야 하는 동의. 셋 다 true여야 서버가 받는다 (app/auth/schemas.py). */
export type RegisterConsent = { terms: boolean; privacy: boolean; age: boolean };

export type RegisterInput = LoginInput & { nickname: string; consent: RegisterConsent };

export async function login(input: LoginInput): Promise<User> {
  const tokenResponse = await apiClient.post<TokenPair>('/auth/login', input);
  await tokenStore.save(tokenResponse.data);
  return getMe();
}

export async function register(input: RegisterInput): Promise<User> {
  const response = await apiClient.post<RegisterResponse>('/auth/register', {
    email: input.email,
    nickname: input.nickname,
    password: input.password,
    // 서버가 셋 다 true인지 확인한다. 기본값이 없어서 안 보내면 422가 난다.
    agreed_terms: input.consent.terms,
    agreed_privacy: input.consent.privacy,
    is_over_14: input.consent.age,
  });
  await tokenStore.save(response.data.tokens);
  return response.data.user;
}

export async function getMe(): Promise<User> {
  const response = await apiClient.get<User>('/auth/me');
  return response.data;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    await tokenStore.clear();
  }
}
