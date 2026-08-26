import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '@/features/auth/auth-context';
import { DynamicTabBar } from '@/features/menus/dynamic-tab-bar';
import { LoadingScreen } from '@/shared/components/loading-screen';

export default function TabLayout() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingScreen message="로그인 정보를 확인하고 있어요." />;
  }
  if (status === 'anonymous') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <DynamicTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="schedules" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
