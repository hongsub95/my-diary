import { useCallback, useEffect, useMemo, useRef } from 'react';
import Constants from 'expo-constants';
import { Text } from 'react-native';

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
  const primary = homeAppearance?.primary;
  const primaryDark = homeAppearance?.primaryDark;
  const bottomInset = homeAppearance?.bottomInset ?? 0;
  const html = useMemo(() => mapHtml(key, places, undefined, false, undefined,
    primary && primaryDark ? { primary, primaryDark, bottomInset: 0 } : undefined), [key, places, primary, primaryDark]);
  const syncSelection = useCallback(() => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ type: 'kakao-set-selection', id: selectedId ?? '', bottomInset }), window.location.origin);
  }, [selectedId, bottomInset]);
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
      onLoad={syncSelection}
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
