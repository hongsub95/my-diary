import { useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { mapHtml } from './kakao-map-html';

export type Coordinate = { latitude: number; longitude: number };
export type LocationMapProps = { center: Coordinate; point?: Coordinate | null; onPick: (point: Coordinate) => void };

export function LocationMap({ center, point, onPick }: LocationMapProps) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const extra = Constants.expoConfig?.extra;
  const key = extra?.kakaoJavaScriptKey ?? '';
  const latitude = point?.latitude;
  const longitude = point?.longitude;
  const html = useMemo(() => mapHtml(key, latitude != null && longitude != null ? [{ id: 'selected', name: '선택한 위치', latitude, longitude }] : [], 'selected', true, center), [key, center, latitude, longitude]);
  return <View style={{ height: 300, overflow: 'hidden', borderRadius: 16 }}>
    {failed ? <Pressable onPress={() => { setFailed(false); setAttempt(attempt + 1); }}><Text>지도를 불러오지 못했어요. 다시 시도</Text></Pressable> :
      <WebView key={attempt} source={{ html, baseUrl: extra?.kakaoMapBaseUrl ?? 'http://localhost:8081/' }}
        originWhitelist={['*']} javaScriptEnabled geolocationEnabled={false} scrollEnabled={false}
        onError={() => setFailed(true)} onHttpError={() => setFailed(true)}
        onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url === (extra?.kakaoMapBaseUrl ?? 'http://localhost:8081/')}
        onMessage={event => {
          try {
            const p = JSON.parse(event.nativeEvent.data);
            if (p.type === 'kakao-coordinate-select' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180) onPick({ latitude: p.latitude, longitude: p.longitude });
          } catch { /* Ignore invalid map messages. */ }
        }} />}
  </View>;
}
