/**
 * 서버 메뉴(code)와 이 앱이 가진 라우트의 연결표.
 *
 * 메뉴 목록은 DB에서 오기 때문에 배포 없이도 항목이 늘어난다. 서버가 준 path로 그대로
 * 이동하면, 아직 화면을 만들지 않은 메뉴가 켜지는 순간 매칭되는 Route가 없어 빈 화면이
 * 된다. 그래서 역할을 이렇게 나눈다.
 *
 * - 서버: 무엇을, 어떤 이름·순서·권한으로 보여줄지
 * - 이 표: 그 화면이 이 빌드에 존재하는지
 *
 * 표에 없는 code는 조용히 빠진다. 화면을 새로 만들어 여기에 추가하면, 메뉴를
 * is_active=true로 켜는 것만으로 배포 없이 출시할 수 있다.
 *
 * 키가 path가 아니라 code인 이유: code는 바뀌지 않는 식별자이고(app/menus/models.py),
 * path와 name은 운영 중에 바뀔 수 있다. 값은 App.jsx에 선언한 Route 경로와 같아야 한다.
 * 앱(모바일)도 같은 규칙을 쓴다. mobile/src/features/menus/menu-routes.ts 참고.
 */
export const MENU_PATHS = {
  home: '/home',
  calendar: '/calendar',
  schedules: '/schedules',
  // TODO(임시): 기록 화면이 아직 없다. 하단 메뉴 디자인을 확인하려고 잠시 열어둔 것이라
  // 누르면 매칭되는 Route가 없어 빈 화면이 된다. 기록 화면을 만들 때 이 주석을 지운다.
  records: '/records',
  more: '/more',
}

/**
 * 서버 메뉴 목록에서 이 빌드가 열 수 있는 것만 남긴다.
 *
 * @param {Array<{code: string, name: string, icon: string|null}>} menus 서버 응답의 menus
 * @returns {Array<{code: string, name: string, icon: string|null, path: string}>}
 *   서버가 준 순서를 유지한 목록. path는 서버 값이 아니라 이 표의 값이다.
 */
export function toNavigableMenus(menus) {
  return menus
    .filter((menu) => MENU_PATHS[menu.code])
    .map((menu) => ({
      code: menu.code,
      name: menu.name,
      icon: menu.icon,
      path: MENU_PATHS[menu.code],
    }))
}
