import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentSpaceId } from '@/features/spaces/space-context';
import {
  addSchedulePlace,
  completeSchedule,
  getSchedule,
  listSchedulePlaces,
  listSchedules,
  previewPlaceOptimization,
  removeSchedulePlace,
  reorderSchedulePlaces,
  setPlaceNote,
  setPlaceVisited,
  type AddSchedulePlaceInput,
} from './schedule-api';
import { toScheduleDetailView, toScheduleView, type ScheduleView } from './schedule-adapter';

/**
 * 일정 API에 쓸 스페이스 UUID.
 *
 * 현재 선택한 스페이스를 사용한다. 처음에는 계정의 기본 스페이스를 연다.
 */

export type UseSchedulesOptions = {
  /** 조회 시작일 YYYY-MM-DD */
  from?: string;
  /** 조회 종료일 YYYY-MM-DD */
  to?: string;
  /** 장소까지 받을지. 지도와 장소 이름을 쓰는 화면만 켠다 */
  includePlaces?: boolean;
};

/**
 * 기간별 일정 목록.
 *
 * 기간과 include 여부를 쿼리 키에 모두 넣는다. 빠뜨리면 캘린더가 홈이 받아온
 * 하루치 캐시를 그대로 그린다.
 */
/**
 * 여러 달의 일정을 달마다 따로 조회한다.
 *
 * @param months 'YYYY-MM' 목록. 캘린더는 앞달·이번 달·다음 달을 넘긴다
 * @returns 받은 일정 전부(달이 겹치는 여러 날 하루는 한 번만), 이번 달(가운데)을 받는 중인지, 실패했는지
 *
 * 석 달을 한 번에 조회하면 달을 넘길 때마다 범위가 통째로 바뀌어, 이미 본 달까지 다시
 * 받는 동안 달력이 비었다가 채워졌다. 달마다 캐시하면 넘긴 달은 대부분 이미 받아 둔 상태라
 * 바로 보이고, 새로 필요한 바깥 달 하나만 뒤에서 받는다.
 */
export function useMonthlySchedules(months: string[]) {
  const spaceId = useCurrentSpaceId();
  const results = useQueries({
    queries: months.map(month => {
      const [year, monthNumber] = month.split('-').map(Number);
      const last = new Date(year, monthNumber, 0).getDate();
      const from = `${month}-01`;
      const to = `${month}-${String(last).padStart(2, '0')}`;
      return {
        // useSchedules와 같은 키 모양이라 같은 범위를 쓰는 다른 화면과 캐시를 나눠 쓴다.
        queryKey: ['schedules', spaceId, from, to, false],
        queryFn: async () => (await listSchedules({ spaceId: spaceId as string, from, to, includePlaces: false })).map(toScheduleView),
        enabled: Boolean(spaceId),
      };
    }),
  });
  const byId = new Map<number, ScheduleView>();
  for (const result of results) for (const item of result.data ?? []) byId.set(item.id, item);
  const center = results[Math.floor(results.length / 2)];
  return {
    data: [...byId.values()],
    stamp: results.map(result => result.dataUpdatedAt).join(','),
    isLoading: Boolean(center?.isLoading),
    isError: results.some(result => result.isError),
    refetch: () => Promise.all(results.map(result => result.refetch())),
  };
}

export function useSchedules({ from, to, includePlaces = false }: UseSchedulesOptions = {}) {
  const spaceId = useCurrentSpaceId();

  return useQuery<ScheduleView[]>({
    queryKey: ['schedules', spaceId, from ?? null, to ?? null, includePlaces],
    queryFn: async () => {
      const items = await listSchedules({ spaceId: spaceId as string, from, to, includePlaces });
      return items.map(toScheduleView);
    },
    // 로그인 전이거나 기본 스페이스가 없으면 부를 경로 자체가 없다.
    enabled: Boolean(spaceId),
  });
}

/**
 * 일정 상세. 장소까지 함께 채워서 돌려준다.
 *
 * 상세 응답은 include를 받지 않아 장소가 따로 온다(API_SPEC 5.2절). 둘 다 같은 일정을
 * 보는 요청이라 순서에 의존하지 않고 동시에 보낸다.
 */
export function useSchedule(scheduleId: number) {
  return useQuery<ScheduleView>({
    queryKey: ['schedules', 'detail', scheduleId],
    queryFn: async () => {
      const [schedule, places] = await Promise.all([
        getSchedule(scheduleId),
        listSchedulePlaces(scheduleId),
      ]);
      return toScheduleDetailView(schedule, places);
    },
    enabled: Number.isFinite(scheduleId),
  });
}

/**
 * 한 하루의 상태를 바꾼다. 완료 처리와 장소 방문 체크를 함께 다룬다.
 *
 * 둘을 한 훅에 둔 이유: 화면에서 모두 "이 하루를 진행하는" 행동이고, 어느 쪽이 바뀌어도
 * 홈 카드의 다음 장소·진행률과 목록의 요약이 함께 달라진다.
 */
export function useScheduleActions(scheduleId: number) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    queryClient.invalidateQueries({ queryKey: ['diaries'] });
  };

  const complete = useMutation({
    mutationFn: () => completeSchedule(scheduleId),
    onSuccess: invalidate,
  });

  const toggleVisited = useMutation({
    mutationFn: ({ schedulePlaceId, visited }: { schedulePlaceId: number; visited: boolean }) =>
      setPlaceVisited(scheduleId, schedulePlaceId, visited),
    onSuccess: invalidate,
  });

  const addPlace = useMutation({
    mutationFn: (place: AddSchedulePlaceInput) => addSchedulePlace(scheduleId, place),
    onSuccess: invalidate,
  });

  const removePlace = useMutation({
    mutationFn: (schedulePlaceId: number) => removeSchedulePlace(scheduleId, schedulePlaceId),
    onSuccess: invalidate,
  });

  // 예정시각·메모 저장. 목록의 요약 줄도 함께 달라지므로 같은 캐시를 무효화한다.
  const updatePlaceNote = useMutation({
    mutationFn: ({
      schedulePlaceId,
      ...note
    }: {
      schedulePlaceId: number;
      plannedTime: string | null;
      memo: string | null;
    }) => setPlaceNote(scheduleId, schedulePlaceId, note),
    onSuccess: invalidate,
  });

  // 순서는 전체 목록을 한 번에 보낸다. 화면이 위·아래로 한 칸씩 옮기더라도 서버에는
  // 바뀐 전체 배열이 간다 (API_SPEC 6.4절).
  const reorderPlaces = useMutation({
    mutationFn: (schedulePlaceIds: number[]) =>
      reorderSchedulePlaces(scheduleId, schedulePlaceIds),
    onSuccess: invalidate,
  });

  // 제안만 받아온다. 일정은 바뀌지 않으므로 목록을 다시 읽을 이유가 없다 —
  // onSuccess에 invalidate를 두지 않는 이유다.
  const optimizePlaces = useMutation({
    mutationFn: () => previewPlaceOptimization(scheduleId),
  });

  return {
    complete,
    toggleVisited,
    addPlace,
    removePlace,
    updatePlaceNote,
    reorderPlaces,
    optimizePlaces,
  };
}
