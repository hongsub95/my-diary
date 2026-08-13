import { useQuery } from '@tanstack/react-query'
import { MOCK_SCHEDULES } from './mocks'
import { apiClient } from './client'

async function fetchMenus() {
  const { data } = await apiClient.get('/menus', {
    params: { scope: 'app' },
  })

  if (!Array.isArray(data?.menus)) {
    throw new Error('메뉴 응답 형식이 올바르지 않습니다.')
  }

  const navigableMenus = data.menus.filter((menu) => menu.path)
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
