import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/auth-context';
import { listSchedules } from './schedule-api';
import { toScheduleView, type ScheduleView } from './schedule-adapter';

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
