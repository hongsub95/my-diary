// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // .expo/types는 expo-router가 라우트에서 자동 생성하는 파일이다. 사람이 고치지
    // 않으므로 검사 대상이 아니고, 재생성될 때마다 경고가 새로 뜬다.
    ignores: ["dist/*", ".expo/*"],
  }
]);
