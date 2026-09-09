import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-context';
import {
  completeSchedule,
  getSchedule,
  listSchedulePlaces,
  listSchedules,
  setPlaceVisited,
} from './schedule-api';
import { toScheduleDetailView, toScheduleView, type ScheduleView } from './schedule-adapter';

/**
 * 일정 API에 쓸 스페이스 UUID.
 *
 * 로그인 응답에 이미 담겨 오므로 따로 조회하지 않는다(API_SPEC 3.5절).
 */
function useDefaultSpaceId(): string | null {
  const { user } = useAuth();
  return user?.default_space_id ?? null;
}

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
export function useSchedules({ from, to, includePlaces = false }: UseSchedulesOptions = {}) {
  const spaceId = useDefaultSpaceId();

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

  return { complete, toggleVisited };
}
