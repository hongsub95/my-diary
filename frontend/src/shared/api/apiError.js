import axios from 'axios'

const FALLBACK_MESSAGE = '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.'
const NETWORK_MESSAGE = '서버에 연결할 수 없습니다. 백엔드가 켜져 있는지 확인해주세요.'

/**
 * 오류 객체에서 화면에 그대로 띄울 문구를 꺼낸다.
 *
 * 백엔드는 모든 오류를 {code, message, field} 형태로 통일하고 message를 한국어로
 * 내려주기로 되어 있다(docs/API_SPEC.md 2.5절, app/core/errors.py). 그래서 프론트에서
 * 상태 코드별로 문구를 다시 만들지 않고 서버 문구를 그대로 보여준다. 서버가 문구를
 * 고치면 배포 없이 반영되고, 웹과 앱이 같은 말을 하게 된다.
 *
 * @param {unknown} error axios가 던진 오류
 * @returns {string} 사용자에게 보여줄 한국어 문구
 */
export function getApiErrorMessage(error) {
  if (!axios.isAxiosError(error)) return FALLBACK_MESSAGE

  const data = error.response?.data
  if (data && typeof data.message === 'string' && data.message) {
    return data.message
  }

  // 응답 자체가 없는 경우다. 서버가 꺼져 있거나 CORS에 막힌 상황이라 서버 문구가 없다.
  return error.code === 'ERR_NETWORK' ? NETWORK_MESSAGE : FALLBACK_MESSAGE
}
