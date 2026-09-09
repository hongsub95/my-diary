import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-context';
import {
  addTimelineItem,
  deleteDiaryEntry,
  deleteDiaryPhoto,
  deleteTimelineItem,
  listDiaryEntries,
  listDiaryPhotos,
  listDiaryTimeline,
  listSpaceDiaries,
  uploadDiaryPhotos,
  upsertDiaryEntry,
  type NewTimelineItem,
  type PickedPhoto,
} from './diary-api';
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

/**
 * 한 하루의 일기(작성자별 본문 + 공용 사진 + 방문 타임라인)를 읽고 쓴다.
 *
 * 셋을 한 훅에서 다루는 이유: 화면에서 이들은 "오늘을 남기기"라는 하나의 행동이고,
 * 어느 쪽이 바뀌어도 기록 목록의 카드(대표 사진·발췌·기록 여부)가 함께 달라진다.
 */
export function useDiary(scheduleId: number) {
  const queryClient = useQueryClient();

  const entries = useQuery({
    queryKey: ['diary', scheduleId, 'entries'],
    queryFn: () => listDiaryEntries(scheduleId),
  });

  const photos = useQuery({
    queryKey: ['diary', scheduleId, 'photos'],
    queryFn: () => listDiaryPhotos(scheduleId),
  });

  const timeline = useQuery({
    queryKey: ['diary', scheduleId, 'timeline'],
    queryFn: () => listDiaryTimeline(scheduleId),
  });

  // 일기가 바뀌면 이 하루의 상세뿐 아니라 일정 목록의 요약과 기록 탭 카드도 달라진다.
  // 세 갈래를 모두 무효화해야 화면 사이에서 값이 어긋나지 않는다.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['diary', scheduleId] });
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    queryClient.invalidateQueries({ queryKey: ['diaries'] });
  };

  const saveEntry = useMutation({
    mutationFn: ({ content, mood }: { content: string; mood: string | null }) =>
      upsertDiaryEntry(scheduleId, content, mood),
    onSuccess: invalidate,
  });

  const removeEntry = useMutation({
    mutationFn: () => deleteDiaryEntry(scheduleId),
    onSuccess: invalidate,
  });

  const addPhotos = useMutation({
    mutationFn: (picked: PickedPhoto[]) => uploadDiaryPhotos(scheduleId, picked),
    onSuccess: invalidate,
  });

  const removePhoto = useMutation({
    mutationFn: (photoId: number) => deleteDiaryPhoto(photoId),
    onSuccess: invalidate,
  });

  const addTimeline = useMutation({
    mutationFn: (item: NewTimelineItem) => addTimelineItem(scheduleId, item),
    onSuccess: invalidate,
  });

  const removeTimeline = useMutation({
    mutationFn: (itemId: number) => deleteTimelineItem(itemId),
    onSuccess: invalidate,
  });

  return {
    entries,
    photos,
    timeline,
    saveEntry,
    removeEntry,
    addPhotos,
    removePhoto,
    addTimeline,
    removeTimeline,
  };
}
