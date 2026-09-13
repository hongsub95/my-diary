import { useEffect, useMemo, useRef } from 'react';
import Constants from 'expo-constants';
import { mapHtml } from './kakao-map-html';
import type { LocationMapProps } from './location-map';

export function LocationMap({ center, point, onPick }: LocationMapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const key = Constants.expoConfig?.extra?.kakaoJavaScriptKey ?? '';
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  const html = useMemo(() => mapHtml(key, latitude != null && longitude != null ? [{ id: 'selected', name: '선택한 위치', latitude, longitude }] : [], 'selected', true, center), [key, center, latitude, longitude]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return;
      try {
        const p = JSON.parse(event.data);
        if (p.type === 'kakao-coordinate-select' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180) onPick({ latitude: p.latitude, longitude: p.longitude });
      } catch { /* Ignore invalid messages. */ }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onPick]);
  return <iframe ref={frame} title="지도에서 위치 선택" srcDoc={html} style={{ width: '100%', height: 300, border: 0, borderRadius: 16 }} />;
}
