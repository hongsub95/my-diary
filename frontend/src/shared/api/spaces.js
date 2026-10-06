import { apiClient } from './client'

/**
 * 내가 활성 멤버인 공간 목록을 가져온다. 보관된 공간은 서버가 빼고 준다.
 *
 * @returns {Promise<Array<object>>} 공간 배열
 *
 * 정렬은 서버가 보장한다(개인 공간가 항상 먼저). 화면에서 다시 정렬하지 않는다.
 *
 * 공간 전환, 관리, 계정 탈퇴 경고에 함께 사용한다.
 */
export async function listSpaces() {
  const { data } = await apiClient.get('/spaces')
  return Array.isArray(data?.spaces) ? data.spaces : []
}

export async function getSpace(id) {
  return (await apiClient.get(`/spaces/${id}`)).data
}

export async function createSpace({ name, icon }) {
  return (await apiClient.post('/spaces', { name, icon })).data
}

export async function updateSpace(id, { name }) {
  return (await apiClient.patch(`/spaces/${id}`, { name })).data
}

export async function deleteSpace(id) {
  await apiClient.delete(`/spaces/${id}`)
}

export async function joinSpace(joinCode) {
  return (await apiClient.post('/spaces/join', { join_code: joinCode })).data
}

export async function regenerateJoinCode(id) {
  return (await apiClient.post(`/spaces/${id}/join-code/regenerate`)).data
}

export async function listMembers(id) {
  return (await apiClient.get(`/spaces/${id}/members`)).data.members
}

export async function removeMember(id, userId) {
  await apiClient.delete(`/spaces/${id}/members/${userId}`)
}

export async function leaveSpace(id) {
  await apiClient.post(`/spaces/${id}/leave`)
}

export async function transferOwnership(id, userId) {
  await apiClient.post(`/spaces/${id}/transfer-ownership`, { user_id: userId })
}

export async function setDefaultSpace(id) {
  return (await apiClient.put('/users/me/default-space', { space_id: id })).data
}
