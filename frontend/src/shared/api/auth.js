import { apiClient } from './client'

// 웹은 세션 방식이라 /auth/web/* 를 쓴다. 세션 ID가 httpOnly 쿠키로 오기 때문에
// 자바스크립트가 읽거나 저장할 값이 없고, 이후 요청에는 브라우저가 알아서 붙인다.
// (앱은 같은 계정으로 /auth/* 의 JWT를 쓴다. app/auth/web_router.py 참고)
//
// 쿠키를 받으려면 요청에 credentials가 실려야 하는데, 그 설정은 client.js의
// withCredentials가 담당한다.

/**
 * 현재 로그인한 사용자를 조회한다.
 *
 * 새로고침 후 로그인 상태를 알아내는 유일한 방법이다. 세션 쿠키는 httpOnly라
 * 자바스크립트가 볼 수 없으므로, 쿠키를 확인하는 대신 서버에 물어본다.
 *
 * @returns {Promise<object>} 사용자 정보
 * @throws 로그인 상태가 아니면 401
 */
export async function fetchMe() {
  const { data } = await apiClient.get('/auth/me')
  return data
}

/**
 * 이메일·비밀번호로 로그인한다. 성공하면 응답에 세션 쿠키가 함께 실려 온다.
 *
 * @param {{email: string, password: string}} credentials
 * @returns {Promise<object>} 로그인한 사용자 정보
 */
export async function webLogin({ email, password }) {
  const { data } = await apiClient.post('/auth/web/login', { email, password })
  return data
}

/**
 * 회원가입한다. 가입 직후 바로 로그인 상태가 되므로 따로 로그인할 필요가 없다.
 *
 * @param {{email: string, nickname: string, password: string}} form
 * @returns {Promise<object>} 가입한 사용자 정보
 */
export async function webRegister({ email, nickname, password }) {
  const { data } = await apiClient.post('/auth/web/register', { email, nickname, password })
  return data
}

/**
 * 로그아웃한다. 서버가 세션을 지우고 쿠키도 함께 지운다.
 *
 * 인증을 요구하지 않는 엔드포인트라, 이미 만료된 세션으로 호출해도 실패하지 않는다.
 */
export async function webLogout() {
  await apiClient.post('/auth/web/logout')
}
