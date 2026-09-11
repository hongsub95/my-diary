// 지도 HTML의 좌표 필터 및 사용자 입력의 스크립트 탈출을 독립 검증한다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('src/features/places/kakao-map-html.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(code, context);
const { hasCoordinates, mapHtml } = context.exports;
assert.equal(hasCoordinates({ latitude: null, longitude: '127' }), false);
assert.equal(hasCoordinates({ latitude: 'NaN', longitude: '127' }), false);
assert.equal(hasCoordinates({ latitude: '91', longitude: '127' }), false);
assert.equal(hasCoordinates({ latitude: '37.5', longitude: '127' }), true);
const html = mapHtml('public-test-key', [{
  id: '1', name: '</script><script>alert(1)</script>', latitude: '37.5', longitude: '127',
}]);
assert.equal((html.match(/<script>/g) || []).length, 1);
assert.equal((html.match(/<\/script>/g) || []).length, 1);
new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const config = require('../app.config.js')({ config: {} });
assert.equal('kakaoRestApiKey' in config.extra, false);
assert.equal('kakaoNativeAppKey' in config.extra, false);
console.log('Map coordinate, script escaping, syntax and public-config checks passed.');
