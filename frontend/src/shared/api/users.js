import { apiClient } from './client'

// 더보기 > 내 정보에서 쓰는 계정 설정 API다. 로그인·회원가입(auth.js)과 파일을
// 나눈 이유: 저쪽은 '로그인 상태를 만드는' 호출이고 여기는 '이미 로그인한 사람이
// 자기 계정을 고치는' 호출이라, 실패했을 때 화면이 할 일이 다르다.

/**
 * 프로필을 바꾼다. **넘긴 필드만 바뀐다.**
 *
 * @param {{nickname?: string, themeKey?: string}} form
 * @returns {Promise<object>} 갱신된 사용자 정보. `/auth/me`와 같은 형태다
 * @throws 다른 사람이 쓰는 닉네임이면 409, 지원하지 않는 테마 키면 422
 *
 * 응답을 그대로 AuthContext에 넣으면 상단 프로필과 테마가 함께 갱신된다.
 *
 * 보내지 않은 필드를 서버가 건드리지 않기 때문에, 테마 화면이 닉네임을 같이 실어
 * 보낼 필요가 없다. 그렇게 하면 그 사이 다른 기기에서 바꾼 닉네임을 옛 값으로
 * 덮어쓰게 된다.
 */
export async function updateProfile({ nickname, themeKey }) {
  const body = {}
  if (nickname !== undefined) body.nickname = nickname
  if (themeKey !== undefined) body.theme_key = themeKey

  const { data } = await apiClient.patch('/users/me', body)
  return data
}

/**
 * 비밀번호를 바꾼다.
 *
 * @param {{currentPassword: string, newPassword: string}} form
 * @returns {Promise<void>} 성공하면 204라 본문이 없다
 * @throws 현재 비밀번호가 틀리면 422 (`INVALID_CURRENT_PASSWORD`)
 *
 * **성공해도 로그아웃되지 않는다.** 서버가 지금 쓰는 세션만 남기고 다른 기기의
 * 세션을 끊기 때문이다(docs/API_SPEC.md 3-U절). 그래서 호출한 화면은 재로그인을
 * 시킬 필요가 없다.
 *
 * 현재 비밀번호가 틀릴 때 서버가 401이 아니라 422를 주는 것도 같은 이유다.
 * 401은 "인증이 만료됐으니 로그인 화면으로 보낸다"는 뜻으로 약속돼 있어서
 * (docs/BOTTOM_NAVIGATION_SPEC.md 8.1절), 그 코드를 쓰면 비밀번호 오타 한 번에
 * 사용자가 화면 밖으로 튕겨 나간다.
 */
export async function changePassword({ currentPassword, newPassword }) {
  await apiClient.put('/users/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

/**
 * 계정을 탈퇴 처리한다.
 *
 * @param {{currentPassword: string}} form 재인증용 비밀번호
 * @returns {Promise<void>} 성공하면 204라 본문이 없다
 * @throws 비밀번호가 틀리면 422 (`INVALID_CURRENT_PASSWORD`). 이때는 아무것도 지워지지 않는다
 *
 * **DELETE인데 본문을 보낸다.** 재인증 비밀번호를 실어야 해서다. axios는 두 번째 인자가
 * config이므로 `{ data }`로 감싸야 본문이 실린다 — 다른 메서드처럼 바로 넘기면
 * 조용히 빈 본문이 나가고 서버는 422를 돌려준다.
 *
 * 성공하면 서버가 세션 쿠키까지 지운다. 호출한 화면은 로컬 로그인 상태를 비우고
 * 로그인 화면으로 보내면 된다.
 */
export async function deleteAccount({ currentPassword }) {
  await apiClient.delete('/users/me', { data: { current_password: currentPassword } })
}
