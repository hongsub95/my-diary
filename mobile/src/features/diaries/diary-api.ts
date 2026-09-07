import { apiClient } from '@/shared/api/client';
import type { DiaryFeedResponse } from '@/shared/api/types';

// 일기 API 호출만 담당한다. 응답을 화면 형태로 바꾸는 일은 diary-adapter.ts가 한다.
// 명세는 docs/API_SPEC.md 7장이며, 웹의 frontend/src/shared/api/diaries.js와 같은 규격이다.

export type ListSpaceDiariesParams = {
  /** 스페이스 공개 UUID. /auth/me의 default_space_id를 그대로 쓴다 */
  spaceId: string;
  /** 이전 응답의 next_cursor. 없으면 처음부터 */
  cursor?: string;
  /** 아직 기록이 없는 지난 하루도 포함할지 */
  includePending?: boolean;
};

/**
 * 기록 탭 목록을 한 페이지 가져온다.
 *
 * cursor는 서버가 준 값을 **해석하지 말고 그대로** 돌려준다. 내용을 뜯어보기 시작하면
 * 서버가 정렬 기준을 바꿀 때 앱이 함께 깨진다.
 */
export async function listSpaceDiaries({
  spaceId,
  cursor,
  includePending = false,
}: ListSpaceDiariesParams): Promise<DiaryFeedResponse> {
  const response = await apiClient.get<DiaryFeedResponse>(`/spaces/${spaceId}/diaries`, {
    params: {
      cursor,
      ...(includePending ? { include_pending: true } : {}),
    },
  });
  return response.data;
}
