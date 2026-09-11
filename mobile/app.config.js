const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseEnv } = require('node:util');

module.exports = ({ config }) => {
  const file = resolve(__dirname, '../.env');
  const rootEnv = existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : {};
  return {
    ...config,
    extra: {
      ...config.extra,
      // 지도 JavaScript 키만 공개 설정에 포함한다. REST/Native 키는 복사하지 않는다.
      kakaoJavaScriptKey: process.env.KAKAO_JAVASCRIPT_KEY || rootEnv.KAKAO_JAVASCRIPT_KEY || '',
      kakaoMapBaseUrl: process.env.EXPO_PUBLIC_KAKAO_MAP_BASE_URL || 'http://localhost:8081/',
    },
  };
};
