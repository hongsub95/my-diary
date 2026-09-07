import { useInfiniteQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-context';
import { listSpaceDiaries } from './diary-api';
import { toRecordPage, type RecordPage } from './diary-adapter';

/**
 * 일기 API에 쓸 스페이스 UUID. 로그인 응답에 이미 담겨 오므로 따로 조회하지 않는다.
 */
function useDefaultSpaceId(): string | null {
  const { user } = useAuth();
  return user?.default_space_id ?? null;
}

export type UseDiaryFeedOptions = {
  /** 아직 기록이 없는 지난 하루도 포함할지 */
  includePending?: boolean;
};

/**
 * 기록 탭 목록. 아래로 내려가며 이어 받는다.
 *
 * 기간으로 자르는 일정 목록과 달리 개수가 계속 늘어나므로 커서 방식을 쓴다. 커서 값은
 * 서버가 준 것을 그대로 돌려주며, 화면은 내용을 해석하지 않는다.
 */
export function useDiaryFeed({ includePending = false }: UseDiaryFeedOptions = {}) {
  const spaceId = useDefaultSpaceId();

  return useInfiniteQuery<RecordPage>({
    queryKey: ['diaries', spaceId, includePending],
    queryFn: async ({ pageParam }) => {
      const page = await listSpaceDiaries({
        spaceId: spaceId as string,
        cursor: pageParam as string | undefined,
        includePending,
      });
      return toRecordPage(page);
    },
    // 첫 페이지는 커서 없이 부른다.
    initialPageParam: undefined,
    // null이면 마지막 페이지다. undefined를 돌려줘야 react-query가 더 안 부른다.
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(spaceId),
  });
}
