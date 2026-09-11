import { useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { hasCoordinates, mapHtml, type MapProps } from './kakao-map-html';

export function KakaoMap({ places, selectedId, onSelect }: MapProps) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const extra = Constants.expoConfig?.extra;
  const html = useMemo(() => mapHtml(extra?.kakaoJavaScriptKey ?? '', places, selectedId), [extra?.kakaoJavaScriptKey, places, selectedId]);
  if (!places.some(hasCoordinates)) return <Text style={{ color: '#736d62', padding: 12 }}>좌표가 있는 장소를 추가하면 지도에 표시돼요.</Text>;
  return <View style={{ height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f6f3ed' }}>
    {failed ? <Pressable onPress={() => { setFailed(false); setAttempt(attempt + 1); }} style={{ padding: 24 }}><Text>지도를 불러오지 못했어요. 눌러서 다시 시도</Text></Pressable> :
      <WebView key={attempt} source={{ html, baseUrl: extra?.kakaoMapBaseUrl ?? 'http://localhost:8081/' }}
        originWhitelist={['*']} javaScriptEnabled scrollEnabled={false} geolocationEnabled={false}
        onError={() => setFailed(true)} onHttpError={() => setFailed(true)}
        onShouldStartLoadWithRequest={(request) => request.url === 'about:blank' || request.url === (extra?.kakaoMapBaseUrl ?? 'http://localhost:8081/')}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data);
            if (message.type === 'kakao-place-select' && places.some(p => p.id === message.id)) onSelect?.(message.id);
          } catch { /* 외부 메시지는 무시한다. */ }
        }} style={{ flex: 1, backgroundColor: '#f6f3ed' }} />}
  </View>;
}
