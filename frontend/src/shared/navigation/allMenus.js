// 하단 메뉴는 서버의 노출·이름·순서를 그대로 사용한다. 추가 메뉴는 이 목록에서 확장한다.
const EXTRA_MENUS = [
  { code: 'collection', name: '모아보기', icon: '▦', path: '/more/collection', order: 100, visible: true },
]
const GLYPHS = { home: '⌂', calendar: '▦', schedules: '☰', records: '❏' }

// 이 타일 목록은 더보기 화면 안에 있다. 거기에 '더보기'를 또 넣으면 자기 자신으로
// 들어가는 칸이 생긴다. 하단 탭에서 그대로 옮겨오되 이것만 뺀다.
const SELF_CODE = 'more'

export function buildAllMenus(bottomMenus) {
  return [
    ...bottomMenus
      .filter(menu => menu.code !== SELF_CODE)
      .map((menu, order) => ({ ...menu, icon: GLYPHS[menu.code] ?? '•', order, visible: true })),
    ...EXTRA_MENUS,
  ].filter(menu => menu.visible).sort((a, b) => a.order - b.order)
}
