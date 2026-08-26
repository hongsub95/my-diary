/**
 * 서버 메뉴(code)와 이 앱이 가진 탭 화면의 연결표.
 *
 * 메뉴 목록은 DB에서 오기 때문에 배포 없이도 항목이 늘어난다. 서버가 준 path로 그대로
 * 이동하면, 아직 화면을 만들지 않은 메뉴가 켜지는 순간 앱이 not-found로 떨어진다.
 * 스토어에는 구버전 앱이 계속 남아 있어 "서버를 바꿨으니 앱도 따라 바뀐다"가 성립하지
 * 않으므로, 이 방어는 있으면 좋은 게 아니라 없으면 안 되는 쪽이다.
 *
 * 그래서 역할을 이렇게 나눈다.
 * - 서버: 무엇을, 어떤 이름·순서·권한으로 보여줄지
 * - 이 표: 그 화면이 이 앱 버전에 존재하는지
 *
 * 표에 없는 code는 조용히 빠진다. 반대로 화면을 새로 만들어 여기에 추가하면, 메뉴를
 * is_active=true로 켜는 것만으로 배포 없이 출시할 수 있다.
 */

import type { Href } from 'expo-router';

// 키가 path가 아니라 code인 이유: code는 바뀌지 않는 식별자이고(app/menus/models.py),
// path와 name은 운영 중에 바뀔 수 있다. path를 키로 삼으면 서버에서 경로 문구만
// 다듬어도 메뉴가 통째로 사라진다.
// 값은 src/app/(tabs)/ 아래의 파일 이름이다.
export const MENU_SCREENS: Record<string, string> = {
  calendar: 'calendar',
  schedules: 'schedules',
  more: 'more',
};

/**
 * 탭 화면 이름을 라우터가 이해하는 경로로 바꾼다.
 *
 * @param screen MENU_SCREENS의 값. 즉 (tabs) 폴더에 실제로 있는 파일 이름
 * @returns expo-router href
 */
export function tabHref(screen: string): Href {
  return `/(tabs)/${screen}` as Href;
}
