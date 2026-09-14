const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseEnv } = require('node:util');

module.exports = ({ config }) => {
  const file = resolve(__dirname, '../.env');
  const rootEnv = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  return {
    ...config,
    // 평문 HTTP 허용. release APK는 Android 9+에서 http:// 연결을 기본 차단하는데,
    // 로컬 백엔드(http://<LAN IP>:8000)로 실기기 테스트를 하려면 열어야 한다.
    // (debug 빌드는 원래 열려 있어서 이 설정이 필요 없다.)
    //
    // **환경변수로만 켠다.** app.json에 박아두면 운영 빌드까지 평문 연결이 열린 채로
    // 나간다. 테스트할 때만 EXPO_PUBLIC_ALLOW_CLEARTEXT=1을 준다.
    //
    // android.usesCleartextTraffic이 아니라 expo-build-properties를 쓰는 이유:
    // 앱 설정의 그 키는 prebuild가 매니페스트에 반영하지 않는다(SDK 57에서 확인).
    plugins: [
      ...(config.plugins ?? []),
      ...(process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === '1'
        ? [['expo-build-properties', { android: { usesCleartextTraffic: true } }]]
        : []),
    ],
    extra: {
      ...config.extra,
      // 지도 JavaScript 키만 공개 설정에 포함한다. REST/Native 키는 복사하지 않는다.
      kakaoJavaScriptKey: process.env.KAKAO_JAVASCRIPT_KEY || rootEnv.KAKAO_JAVASCRIPT_KEY || '',
      kakaoMapBaseUrl: process.env.EXPO_PUBLIC_KAKAO_MAP_BASE_URL || 'http://localhost:8081/',
    },
  };
};
