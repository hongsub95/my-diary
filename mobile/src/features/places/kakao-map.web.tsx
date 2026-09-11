import { useEffect, useMemo, useRef } from 'react';
import Constants from 'expo-constants';
import { Text } from 'react-native';

import { hasCoordinates, mapHtml, type MapProps } from './kakao-map-html';

export function KakaoMap({ places, selectedId, onSelect }: MapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const key = Constants.expoConfig?.extra?.kakaoJavaScriptKey ?? '';
  const html = useMemo(() => mapHtml(key, places, selectedId), [key, places, selectedId]);
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'kakao-place-select' && places.some(p => p.id === message.id)) onSelect?.(message.id);
      } catch { /* 다른 프레임의 메시지는 무시한다. */ }
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [places, onSelect]);
  if (!places.some(hasCoordinates)) return <Text style={{ color: '#736d62', padding: 12 }}>좌표가 있는 장소를 추가하면 지도에 표시돼요.</Text>;
  return <iframe ref={frame} title="카카오 장소 지도" srcDoc={html} referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', height: 260, border: 0, borderRadius: 16 }} />;
}
