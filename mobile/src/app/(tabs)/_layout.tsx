import { Redirect, Tabs, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-context';
import { DynamicTabBar } from '@/features/menus/dynamic-tab-bar';
import { ChristmasBackdrop } from '@/features/seasonal/christmas-backdrop';
import { scopeForTab } from '@/features/seasonal/season-rules';
import { useSeasonal } from '@/features/seasonal/seasonal-context';
import { colors } from '@/shared/theme';
import { LoadingScreen } from '@/shared/components/loading-screen';

/** 앱을 켠 뒤 배경 장면을 미리 그려 두기까지 기다리는 시간. 첫 화면(홈)을 먼저 그리게 한다. */
const BACKDROP_WARMUP_MS = 600;

/**
 * 하단 탭 묶음.
 *
 * 크리스마스 배경 장면(하늘·전구·골목·눈)은 탭마다 그리지 않고 탭 묶음 뒤에 한 장만 깐다.
 * 탭마다 그리면 탭을 처음 열 때마다 큰 SVG를 새로 만들어 배경이 한 박자 늦게 떴다.
 * 한 장을 앱을 켠 직후 미리 그려 두고 계속 살려 두면, 어느 탭으로 옮겨도 이미 그려진
 * 장면이 바로 보인다. 화면 전체에 배경을 입는 탭은 바탕을 비워 이 장면을 보이고,
 * 홈처럼 배경을 덮는 탭에서는 장면이 가려지므로 눈·반짝임을 멈춘다.
 *
 * 장면은 탭 바 위에서 끝난다. 탭 바 뒤는 탭 바가 눈밭 색으로 따로 칠한다(DynamicTabBar).
 */
export default function TabLayout() {
  const { status } = useAuth();
  const seasonal = useSeasonal();
  const segments = useSegments();
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const [warm, setWarm] = useState(false);
  const activeTab = segments[1] ?? 'home';
  const fullScene = seasonal.visible && scopeForTab(activeTab) === 'full';

  useEffect(() => {
    const timer = setTimeout(() => setWarm(true), BACKDROP_WARMUP_MS);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'loading') {
    return <LoadingScreen message="로그인 정보를 확인하고 있어요." />;
  }
  if (status === 'anonymous') {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={styles.root}>
      {seasonal.visible && (warm || fullScene) && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: tabBarHeight }]}>
          <ChristmasBackdrop night={seasonal.night} active={fullScene} />
        </View>
      )}
      <Tabs
        // 탭 화면 바탕을 비워 둔다. 배경을 입지 않는 때는 화면마다 제 바탕색을 칠한다.
        screenOptions={{ headerShown: false, sceneStyle: styles.scene }}
        tabBar={(props) => <DynamicTabBar {...props} onHeight={setTabBarHeight} />}>
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="home" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="schedules" />
        <Tabs.Screen name="records" />
        <Tabs.Screen name="more" />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scene: { backgroundColor: 'transparent' },
});
