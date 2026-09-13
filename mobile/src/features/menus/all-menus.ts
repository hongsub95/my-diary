import type { Href } from 'expo-router';
import type { NavigableMenu } from './menu-api';
import { tabHref } from './menu-routes';

type AllMenu = { code: string; name: string; icon: string; href: Href; order: number; visible: boolean };
const EXTRA_MENUS: AllMenu[] = [
  { code: 'collection', name: '모아보기', icon: '▦', href: '/more/collection', order: 100, visible: true },
];
const GLYPHS: Record<string, string> = { home: '⌂', calendar: '▦', schedules: '☰', records: '❏', more: '⋯' };

export function buildAllMenus(bottomMenus: NavigableMenu[]): AllMenu[] {
  return [
    ...bottomMenus.map((menu, order) => ({ code: menu.code, name: menu.name, icon: GLYPHS[menu.code] ?? '•', href: tabHref(menu.screen), order, visible: true })),
    ...EXTRA_MENUS,
  ].filter(menu => menu.visible).sort((a, b) => a.order - b.order);
}
