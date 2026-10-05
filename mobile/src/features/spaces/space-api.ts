import { apiClient } from '@/shared/api/client';
import type { SpaceId } from '@/shared/api/types';

export type Space = {
  id: SpaceId;
  type: 'personal' | 'shared';
  name: string;
  icon: string | null;
  join_code: string | null;
  is_default: boolean;
  member_count: number;
  /** 요청자의 역할 */
  my_role: 'owner' | 'member';
  created_at: string;
};

/**
 * 내가 활성 멤버인 스페이스 목록을 가져온다. 보관된 스페이스는 서버가 빼고 준다.
 *
 * 정렬은 서버가 보장한다(개인 스페이스가 항상 먼저). 화면에서 다시 정렬하지 않는다.
 *
 * 스페이스 전환, 관리, 계정 탈퇴 경고에 함께 사용한다.
 */
export async function listSpaces(): Promise<Space[]> {
  const response = await apiClient.get<{ spaces: Space[] }>('/spaces');
  return response.data.spaces ?? [];
}

export type SpaceMember = { user_id: number; nickname: string; email: string; role: 'owner' | 'member'; joined_at: string };

export async function getSpace(id: SpaceId): Promise<Space> {
  return (await apiClient.get<Space>(`/spaces/${id}`)).data;
}
export async function createSpace(input: { name: string; icon: string }): Promise<Space> {
  return (await apiClient.post<Space>('/spaces', input)).data;
}
export async function joinSpace(joinCode: string): Promise<Space> {
  return (await apiClient.post<Space>('/spaces/join', { join_code: joinCode })).data;
}
export async function regenerateJoinCode(id: SpaceId): Promise<{ join_code: string }> {
  return (await apiClient.post<{ join_code: string }>(`/spaces/${id}/join-code/regenerate`)).data;
}
export async function listMembers(id: SpaceId): Promise<SpaceMember[]> {
  return (await apiClient.get<{ members: SpaceMember[] }>(`/spaces/${id}/members`)).data.members;
}
export async function removeMember(id: SpaceId, userId: number): Promise<void> {
  await apiClient.delete(`/spaces/${id}/members/${userId}`);
}
export async function leaveSpace(id: SpaceId): Promise<void> {
  await apiClient.post(`/spaces/${id}/leave`);
}
export async function transferOwnership(id: SpaceId, userId: number): Promise<void> {
  await apiClient.post(`/spaces/${id}/transfer-ownership`, { user_id: userId });
}
export async function setDefaultSpace(id: SpaceId): Promise<Space> {
  return (await apiClient.put<Space>('/users/me/default-space', { space_id: id })).data;
}
