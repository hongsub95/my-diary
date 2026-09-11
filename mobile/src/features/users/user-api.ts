import { apiClient } from '@/shared/api/client';
import type { User } from '@/shared/api/types';

export type UpdateProfileInput = { nickname?: string; themeKey?: string };
export type ChangePasswordInput = { currentPassword: string; newPassword: string };
export type DeleteAccountInput = { currentPassword: string };

/**
 * 프로필을 바꾼다. **넘긴 필드만 바뀐다.**
 *
 * @param input 새 닉네임(앞뒤 공백은 서버가 제거) 또는 테마 키
 * @returns 갱신된 사용자 정보. `/auth/me`와 같은 형태다
 * @throws 다른 사람이 쓰는 닉네임이면 409, 지원하지 않는 테마 키면 422
 *
 * 응답을 auth-context의 updateUser에 넘기면 더보기 상단 카드와 테마가 함께 갱신된다.
 *
 * 보내지 않은 필드를 서버가 건드리지 않기 때문에, 테마 화면이 닉네임을 같이 실어 보낼
 * 필요가 없다. 그렇게 하면 그 사이 다른 기기에서 바꾼 닉네임을 옛 값으로 덮어쓰게 된다.
 */
export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const body: { nickname?: string; theme_key?: string } = {};
  if (input.nickname !== undefined) body.nickname = input.nickname;
  if (input.themeKey !== undefined) body.theme_key = input.themeKey;

  const response = await apiClient.patch<User>('/users/me', body);
  return response.data;
}

/**
 * 비밀번호를 바꾼다.
 *
 * @param input 현재 비밀번호와 새 비밀번호. 새 비밀번호는 회원가입과 같은 규칙이다
 * @throws 현재 비밀번호가 틀리면 422 (`INVALID_CURRENT_PASSWORD`)
 *
 * **성공해도 앱은 로그아웃되지 않는다.** 서버가 끊는 것은 웹 세션이고 앱의 JWT는
 * 무상태라 회수할 수 없다(docs/API_SPEC.md 3-U절). 다른 기기의 앱까지 끊으려면
 * refresh token을 서버에 저장하는 방식으로 바꿔야 한다.
 *
 * 현재 비밀번호가 틀릴 때 서버가 401이 아니라 422를 주는 것이 여기서 특히 중요하다.
 * 401이면 client.ts의 인터셉터가 토큰 재발급을 시도하고, 실패하면 notifyUnauthorized로
 * 로그인 화면까지 보낸다. 비밀번호 오타 한 번에 로그아웃되는 셈이다.
 */
export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await apiClient.put('/users/me/password', {
    current_password: input.currentPassword,
    new_password: input.newPassword,
  });
}

/**
 * 계정을 탈퇴 처리한다.
 *
 * @param input 재인증용 비밀번호
 * @throws 비밀번호가 틀리면 422 (`INVALID_CURRENT_PASSWORD`). 이때는 아무것도 지워지지 않는다
 *
 * **DELETE인데 본문을 보낸다.** 재인증 비밀번호를 실어야 해서다. axios는 두 번째 인자가
 * config이므로 `{ data }`로 감싸야 본문이 실린다 — 다른 메서드처럼 바로 넘기면 조용히
 * 빈 본문이 나가고 서버는 422를 돌려준다.
 *
 * 호출한 화면은 성공 후 토큰을 비우고 로그인 화면으로 보내야 한다. 앱의 access token은
 * 무상태라 서버가 회수할 수 없지만, 탈퇴한 계정은 매 요청 사용자 조회에서 걸러지므로
 * 남아 있어도 아무 API를 부를 수 없다.
 */
export async function deleteAccount(input: DeleteAccountInput): Promise<void> {
  await apiClient.delete('/users/me', { data: { current_password: input.currentPassword } });
}
