import { useQuery } from '@tanstack/react-query'
import { MOCK_SCHEDULES } from './mocks'
import { apiClient } from './client'
import { toNavigableMenus } from '../navigation/menuRoutes'

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

export function useSchedules() {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: () => Promise.resolve(MOCK_SCHEDULES),
  })
}

export function useSchedule(id) {
  return useQuery({
    queryKey: ['schedules', id],
    queryFn: () => Promise.resolve(MOCK_SCHEDULES.find((s) => s.id === id) ?? null),
    enabled: !!id,
  })
}
