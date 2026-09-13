// 하단 메뉴는 서버의 노출·이름·순서를 그대로 사용한다. 추가 메뉴는 이 목록에서 확장한다.
const EXTRA_MENUS = [
  { code: 'collection', name: '모아보기', icon: '▦', path: '/more/collection', order: 100, visible: true },
]
const GLYPHS = { home: '⌂', calendar: '▦', schedules: '☰', records: '❏', more: '⋯' }

export function buildAllMenus(bottomMenus) {
  return [
    ...bottomMenus.map((menu, order) => ({ ...menu, icon: GLYPHS[menu.code] ?? '•', order, visible: true })),
    ...EXTRA_MENUS,
  ].filter(menu => menu.visible).sort((a, b) => a.order - b.order)
}
