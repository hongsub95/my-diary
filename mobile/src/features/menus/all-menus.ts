import type { Href } from 'expo-router';
import type { NavigableMenu } from './menu-api';
import { tabHref } from './menu-routes';

type AllMenu = { code: string; name: string; icon: string; href: Href; order: number; visible: boolean };
const EXTRA_MENUS: AllMenu[] = [
  { code: 'collection', name: '모아보기', icon: '▦', href: '/more/collection', order: 100, visible: true },
];
const GLYPHS: Record<string, string> = { home: '⌂', calendar: '▦', schedules: '☰', records: '❏' };

// 이 타일 목록은 더보기 화면 안에 있다. 거기에 '더보기'를 또 넣으면 자기 자신으로
// 들어가는 칸이 생긴다. 하단 탭에서 그대로 옮겨오되 이것만 뺀다.
const SELF_CODE = 'more';

export function buildAllMenus(bottomMenus: NavigableMenu[]): AllMenu[] {
  return [
    ...bottomMenus
      .filter(menu => menu.code !== SELF_CODE)
      .map((menu, order) => ({ code: menu.code, name: menu.name, icon: GLYPHS[menu.code] ?? '•', href: tabHref(menu.screen), order, visible: true })),
    ...EXTRA_MENUS,
  ].filter(menu => menu.visible).sort((a, b) => a.order - b.order);
}
