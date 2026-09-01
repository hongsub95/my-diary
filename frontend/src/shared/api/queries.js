import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import { toNavigableMenus } from '../navigation/menuRoutes'
import { useAuth } from '../contexts/AuthContext'
import {
  createSchedule,
  getSchedule,
  listSchedulePlaces,
  listSchedules,
} from './schedules'
import { toScheduleDetailView, toScheduleView } from './scheduleAdapter'
import { addSchedulePlace, removeSchedulePlace, searchPlaces } from './places'

async function fetchMenus() {
  const { data } = await apiClient.get('/menus', {
    params: { scope: 'app' },
  })

  if (!Array.isArray(data?.menus)) {
    throw new Error('메뉴 응답 형식이 올바르지 않습니다.')
  }

  // 서버가 준 path를 그대로 쓰지 않고 화면이 있는 메뉴만 남긴다. 이유는 menuRoutes.js 참고.
  const navigableMenus = toNavigableMenus(data.menus)
  if (navigableMenus.length === 0) {
    throw new Error('표시할 수 있는 메뉴가 없습니다.')
  }

  return navigableMenus
}

export function useMenus() {
  return useQuery({
    queryKey: ['menus', 'app'],
    queryFn: fetchMenus,
  })
}

/**
 * 일정 API에 쓸 스페이스 UUID.
 *
 * 로그인 응답에 이미 담겨 오므로 따로 조회하지 않는다. 값이 없으면(로그인 전이거나
 * 기본 스페이스가 없는 계정) 조회를 시작하지 않는다.
 *
 * @returns {string|null} 스페이스 공개 UUID
 */
function useDefaultSpaceId() {
  const { user } = useAuth()
  return user?.default_space_id ?? null
}

/**
 * 기간별 일정 목록.
 *
 * @param {object} [options]
 * @param {string} [options.from] 조회 시작일 `YYYY-MM-DD`. 생략하면 서버가 이번 달로 잡는다
 * @param {string} [options.to] 조회 종료일 `YYYY-MM-DD`
 * @param {boolean} [options.includePlaces] 장소까지 함께 받을지. 지도나 장소 이름을
 *   보여주는 화면만 켠다. 캘린더처럼 개수만 쓰는 화면은 끄는 편이 응답이 가볍다
 */
export function useSchedules({ from, to, includePlaces = false } = {}) {
  const spaceId = useDefaultSpaceId()

  return useQuery({
    // 기간과 include 여부가 다르면 다른 응답이므로 키에 모두 넣는다. 빠뜨리면 캘린더가
    // 홈이 받아온 하루치 캐시를 그대로 그린다.
    queryKey: ['schedules', spaceId, from ?? null, to ?? null, includePlaces],
    queryFn: async () => {
      const items = await listSchedules({ spaceId, from, to, includePlaces })
      return items.map(toScheduleView)
    },
    enabled: Boolean(spaceId),
  })
}

/**
 * 일정 상세. 장소까지 함께 채워서 돌려준다.
 *
 * @param {number|string} id 일정 id
 */
export function useSchedule(id) {
  return useQuery({
    queryKey: ['schedules', 'detail', id],
    queryFn: async () => {
      // 상세는 include를 받지 않아 장소를 따로 부른다. 둘 다 같은 일정을 보는 요청이라
      // 순서에 의존하지 않고 동시에 보낸다.
      const [schedule, places] = await Promise.all([getSchedule(id), listSchedulePlaces(id)])
      return toScheduleDetailView(schedule, places)
    },
    enabled: Boolean(id),
  })
}

/**
 * 일정 생성.
 *
 * 성공하면 목록 캐시를 무효화해 캘린더·홈·일정 목록이 새 일정을 바로 반영하게 한다.
 */
export function useCreateSchedule() {
  const spaceId = useDefaultSpaceId()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ title, description, startAt, endAt }) =>
      createSchedule({ spaceId, title, description, startAt, endAt }),
    onSuccess: () => {
      // 기간·include 조합마다 키가 달라서 개별로 지우기 어렵다. 접두사로 한 번에 무효화한다.
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
    },
  })
}

/**
 * 장소 검색.
 *
 * @param {string} query 검색어. 비어 있으면 조회하지 않는다
 */
export function usePlaceSearch(query) {
  return useQuery({
    queryKey: ['places', 'search', query],
    queryFn: () => searchPlaces(query),
    // 글자를 지웠을 때 이전 결과가 남지 않도록 빈 검색어에서는 아예 끈다.
    enabled: query.trim().length > 0,
  })
}

/**
 * 일정에 장소를 추가하거나 뺀다.
 *
 * 성공하면 상세와 목록 캐시를 모두 무효화한다. 장소가 바뀌면 상세의 장소 목록뿐
 * 아니라 홈 지도와 일정 목록의 장소 요약도 함께 달라지기 때문이다.
 *
 * @param {number|string} scheduleId 대상 일정 id
 */
export function useSchedulePlaceMutations(scheduleId) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] })
  }

  const add = useMutation({
    mutationFn: ({ place, memo }) => addSchedulePlace({ scheduleId, place, memo }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (schedulePlaceId) => removeSchedulePlace({ scheduleId, schedulePlaceId }),
    onSuccess: invalidate,
  })

  return { add, remove }
}
