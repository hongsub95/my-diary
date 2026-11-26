import { useCallback, useEffect, useMemo, useRef } from 'react';
import Constants from 'expo-constants';
import { Text } from 'react-native';

import { useTheme } from '@/shared/theme-context';

import { hasCoordinates, mapHtml, type MapProps } from './kakao-map-html';

export function KakaoMap({
  places,
  selectedId,
  onSelect,
  fullBleed = false,
  showEmptyMap = false,
  homeAppearance,
}: MapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const key = Constants.expoConfig?.extra?.kakaoJavaScriptKey ?? '';
  // 마커는 홈이 아닌 지도도 사용자가 고른 테마 색을 따른다.
  const palette = useTheme();
  const primary = homeAppearance?.primary ?? palette.primary;
  const primaryDark = homeAppearance?.primaryDark ?? palette.primaryDark;
  const isHome = Boolean(homeAppearance);
  const bottomInset = homeAppearance?.bottomInset ?? 0;
  const html = useMemo(() => mapHtml(key, places, undefined, false, undefined,
    isHome ? { primary, primaryDark, bottomInset: 0 } : undefined, { primary, primaryDark }), [key, places, primary, primaryDark, isHome]);
  // 시트 높이와 고른 장소는 따로 보낸다. 같이 보내면 시트만 움직여도 고른 장소로 지도를 다시 옮긴다.
  const syncInset = useCallback(() => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ type: 'kakao-set-selection', bottomInset }), window.location.origin);
  }, [bottomInset]);
  const syncSelection = useCallback(() => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ type: 'kakao-set-selection', id: selectedId ?? '' }), window.location.origin);
  }, [selectedId]);
  useEffect(syncInset, [syncInset, html]);
  useEffect(syncSelection, [syncSelection, html]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'kakao-place-select' && places.some((place) => place.id === message.id)) {
          onSelect?.(message.id);
        }
      } catch {
        // 다른 프레임의 메시지는 무시한다.
      }
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [places, onSelect]);

  if (!showEmptyMap && !places.some(hasCoordinates)) {
    return <Text style={{ color: '#736d62', padding: 12 }}>좌표가 있는 장소를 추가하면 지도에 표시돼요.</Text>;
  }

  return (
    <iframe
      ref={frame}
      title="카카오 장소 지도"
      srcDoc={html}
      onLoad={() => { syncInset(); syncSelection(); }}
      referrerPolicy="strict-origin-when-cross-origin"
      style={{
        width: '100%',
        height: fullBleed ? '100%' : 260,
        border: 0,
        borderRadius: fullBleed ? 0 : 16,
      }}
    />
  );
}
