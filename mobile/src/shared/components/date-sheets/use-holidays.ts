import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { apiClient } from '@/shared/api/client';

type HolidayResponse = { days: { date: string; names: string[] }[] };

/**
 * 여러 해의 공휴일을 모아 날짜 → 이름 목록으로 돌려준다.
 *
 * @param years 필요한 해. 기간 시트처럼 해를 넘겨 보여줄 때 두세 해가 들어온다
 *
 * 공휴일은 하루 동안 바뀌지 않으므로 오래 캐시한다. 불러오지 못해도 달력은 그대로 쓸 수
 * 있어야 하므로 실패는 조용히 빈 목록으로 본다(주말 색은 공휴일과 상관없이 칠한다).
 * 이전 팝오버와 같은 queryKey라 캐시를 그대로 이어 쓴다.
 */
export function useHolidays(years: number[]): Map<string, string[]> {
  const unique = [...new Set(years)].sort();
  const results = useQueries({
    queries: unique.map(year => ({
      queryKey: ['calendar-holidays', 'KR', year],
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        (await apiClient.get<HolidayResponse>('/calendar/holidays', { params: { year, country: 'KR' }, signal })).data,
      staleTime: 86_400_000,
      retry: 1,
    })),
  });
  const stamp = results.map(result => result.dataUpdatedAt).join(',');
  return useMemo(() => {
    const map = new Map<string, string[]>();
    for (const result of results) for (const day of result.data?.days ?? []) map.set(day.date, day.names);
    return map;
    // results 배열은 매 렌더 새로 만들어지므로 데이터가 바뀐 시각으로만 다시 계산한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
}
