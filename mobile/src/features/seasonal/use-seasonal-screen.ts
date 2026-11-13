import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';

import { scopeForTab, type SeasonScope } from './season-rules';
import { useSeasonal } from './seasonal-context';

export type SeasonalScreen = {
  scope: SeasonScope;
  /** 하늘이 화면 전체에 깔리는지 (장면·카드 위 눈·탭 바 눈밭) */
  full: boolean;
  /** 장면이 밤인지 */
  night: boolean;
  /** 카드 밖 글씨를 밤 색(흰색 계열)으로 바꿔야 하는지 */
  onDarkSky: boolean;
  /** 머리말 인사·D-데이 칩을 보여줄지 */
  showGreeting: boolean;
};

/**
 * 탭 화면 하나가 계절 배경을 어떻게 입을지 정한다.
 *
 * @param tab 탭 이름(라우트 이름). season-rules.ts의 scopeForTab 표를 따른다
 *
 * 상태 바 글씨 색도 여기서 맞춘다. 밤하늘 위에서는 흰 글씨, 그 밖에는 검은 글씨다.
 * 화면을 떠날 때 검은 글씨로 되돌린다 — 탭은 떠나도 마운트된 채라, 되돌리지 않으면
 * 다음 화면이 흰 상태 바를 물려받는다.
 */
export function useSeasonalScreen(tab: string): SeasonalScreen {
  const { visible, night } = useSeasonal();
  const scope: SeasonScope = visible ? scopeForTab(tab) : 'none';
  const onDarkSky = scope === 'full' && night;

  useFocusEffect(useCallback(() => {
    StatusBar.setStyle(onDarkSky ? 'light' : 'dark');
    return () => StatusBar.setStyle('dark');
  }, [onDarkSky]));

  return { scope, full: scope === 'full', night, onDarkSky, showGreeting: scope !== 'none' };
}
