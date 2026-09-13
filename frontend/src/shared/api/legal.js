import { apiClient } from './client'

// 약관과 개인정보 처리방침은 서버가 내려준다. 화면에 글을 박아두지 않는 이유는
// app/legal/service.py에 적혀 있다 — 웹과 앱이 서로 다른 약관을 보여주는 상태를
// 막고, 문구를 고칠 때 앱 배포를 기다리지 않기 위해서다.

/** 공개 중인 문서 코드. 서버의 app/legal/service.py DOCUMENTS와 같아야 한다. */
export const LEGAL_DOCUMENTS = {
  privacy: 'privacy-policy',
  terms: 'terms-of-service',
}

/**
 * 약관 문서 하나를 가져온다.
 *
 * @param {string} code `LEGAL_DOCUMENTS`의 값
 * @returns {Promise<{code: string, title: string, updated_at: string, blocks: Array<object>}>}
 *
 * **인증이 필요 없다.** 가입하기 전에 약관을 읽어야 동의할 수 있기 때문이다.
 * 응답의 blocks는 이미 화면이 그릴 수 있는 형태라 마크다운 파서가 필요 없다.
 */
export async function fetchLegalDocument(code) {
  const { data } = await apiClient.get(`/legal/documents/${code}`)
  return data
}
