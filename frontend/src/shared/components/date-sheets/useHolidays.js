import { useQueries } from '@tanstack/react-query'
import { apiClient } from '../../api/client'

/**
 * 여러 해의 공휴일을 모은다.
 *
 * @param {number[]} years 필요한 해. 기간 시트처럼 해를 넘겨 보여줄 때 두세 해가 들어온다
 * @returns {{byDate: Map<string, string[]>, monthCount: (year: number, month: number) => number|null, unavailable: boolean, pending: boolean}}
 *
 * 공휴일은 하루 동안 바뀌지 않아 오래 캐시한다. 불러오지 못해도 날짜는 고를 수 있어야
 * 하므로 실패는 안내만 하고 막지 않는다. 이전 팝오버와 같은 queryKey라 캐시를 이어 쓴다.
 */
export function useHolidays(years) {
  const unique = [...new Set(years)].sort()
  const results = useQueries({
    queries: unique.map((year) => ({
      queryKey: ['calendar-holidays', 'KR', year],
      queryFn: async ({ signal }) => (await apiClient.get('/calendar/holidays', { params: { year, country: 'KR' }, signal })).data,
      staleTime: 86_400_000,
      retry: 1,
    })),
  })
  const byDate = new Map()
  const counts = new Map()
  let unavailable = false
  results.forEach((result, i) => {
    const data = result.data
    if (result.isError || (data && data.coverage !== 'complete')) unavailable = true
    for (const day of Array.isArray(data?.days) ? data.days : []) {
      const extra = { substitute: '대체공휴일', temporary: '임시공휴일', election: '선거일' }[day.kind]
      byDate.set(day.date, extra ? [...day.names, extra] : day.names)
    }
    for (const item of data?.months ?? []) counts.set(`${unique[i]}-${item.month}`, item.status === 'ready' ? item.count : null)
  })
  return {
    byDate,
    monthCount: (year, month) => counts.get(`${year}-${month}`) ?? null,
    unavailable,
    pending: results.some((result) => result.isPending),
  }
}
