import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/shared/api/client';
import type { MenuItem, MenuListResponse } from '@/shared/api/types';
import { MENU_SCREENS } from './menu-routes';

/** 화면이 실제로 존재해서 눌러도 되는 메뉴. screen은 (tabs) 아래 파일 이름이다. */
export type NavigableMenu = {
  code: string;
  name: string;
  icon: string | null;
  screen: string;
};

async function listMenus(): Promise<MenuItem[]> {
  const response = await apiClient.get<MenuListResponse>('/menus', { params: { scope: 'app' } });
  return response.data.menus;
}

/**
 * 이 앱 버전에서 열 수 있는 하단 탭 메뉴만 돌려준다.
 *
 * 서버 응답을 그대로 주지 않고 MENU_SCREENS에 있는 것만 남기므로, 호출하는 쪽은
 * 받은 목록을 그리고 눌러도 없는 화면으로 떨어지지 않는다. 걸러내는 이유와 기준은
 * menu-routes.ts에 적어두었다.
 *
 * @returns react-query 결과. data는 서버가 준 순서를 유지한 NavigableMenu 배열
 */
export function useNavigableMenus() {
  return useQuery({
    queryKey: ['menus', 'app'],
    queryFn: listMenus,
    staleTime: 5 * 60_000,
    // 걸러내기를 queryFn이 아니라 select에 두는 이유: 캐시에는 서버 응답 원본을
    // 남겨두고 화면에 줄 때만 추려야, 나중에 이 캐시를 다른 용도로 재사용할 수 있다.
    select: (menus) =>
      menus.flatMap<NavigableMenu>((menu) => {
        const screen = MENU_SCREENS[menu.code];
        if (!screen) return [];
        return [{ code: menu.code, name: menu.name, icon: menu.icon, screen }];
      }),
  });
}
