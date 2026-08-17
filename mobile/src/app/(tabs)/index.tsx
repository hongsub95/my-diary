import { Redirect } from 'expo-router';

import { useNavigableMenus } from '@/features/menus/menu-api';
import { tabHref } from '@/features/menus/menu-routes';
import { LoadingScreen } from '@/shared/components/loading-screen';
import { ErrorState } from '@/shared/components/error-state';

export default function TabIndexScreen() {
  const menus = useNavigableMenus();

  if (menus.isLoading) return <LoadingScreen message="메뉴를 불러오고 있어요." />;
  if (menus.isError) return <ErrorState message="메뉴를 불러오지 못했습니다." onRetry={() => menus.refetch()} />;

  // 첫 번째 메뉴를 시작 화면으로 삼는다. 어느 것이 첫 번째인지는 서버의 sort_order가
  // 정하므로, 시작 화면을 바꾸려면 앱을 고치지 않고 메뉴 순서만 바꾸면 된다.
  const first = menus.data?.[0];
  if (!first) return <ErrorState message="사용 가능한 메뉴가 없습니다." />;

  return <Redirect href={tabHref(first.screen)} />;
}
