import { apiClient } from './client'

/**
 * 내가 활성 멤버인 스페이스 목록을 가져온다. 보관된 스페이스는 서버가 빼고 준다.
 *
 * @returns {Promise<Array<object>>} 스페이스 배열
 *
 * 정렬은 서버가 보장한다(개인 스페이스가 항상 먼저). 화면에서 다시 정렬하지 않는다.
 *
 * 지금 쓰는 곳은 계정 탈퇴 경고 화면 하나다. 탈퇴하면 내가 owner인 스페이스가 함께
 * 사라지는데(docs/API_SPEC.md 3-U절), 무엇이 사라지는지 알려면 이 목록이 필요하다.
 * 응답의 `my_role`과 `member_count`로 경고 문구를 만든다.
 */
export async function listSpaces() {
  const { data } = await apiClient.get('/spaces')
  return Array.isArray(data?.spaces) ? data.spaces : []
}
