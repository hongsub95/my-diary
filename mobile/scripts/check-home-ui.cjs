// Actual Expo screens, with mocked API, native SecureStore bridge and map SDK.
// Requires the existing Expo web dev server on 8081; never writes to the real API.
const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdir } = require('node:fs/promises');
const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');

const origin = process.env.HOME_UI_ORIGIN || 'http://localhost:8081';
const artifacts = path.resolve(__dirname, '../dist-home-card-check/screenshots');
const shared = { id: '22222222-2222-4222-8222-222222222222', name: '우리의 공간', type: 'shared', my_role: 'owner', member_count: 2, is_default: true, join_code: 'K7M2QX9P' };
const personal = { ...shared, id: '11111111-1111-4111-8111-111111111111', name: '나만의 공간', type: 'personal', member_count: 1, is_default: false, join_code: null };
const summary = { has_content: false, has_diary_text: false, photo_count: 0, timeline_count: 0, cover_thumbnail_url: null, diary_excerpt: null };
const place = (id, name, order, visited, coordinates = true) => ({
  id, sort_order: order, visited, planned_time: '15:30:00', memo: null, address_detail: null,
  place: { id, name, address: '서울 성동구', latitude: coordinates ? '37.546' : null, longitude: coordinates ? String(127.035 + order * .004) : null, provider: 'manual', provider_place_id: null },
});
const schedule = (id, day, title, places) => ({
  id, space_id: shared.id, space_name: shared.name, title, description: null,
  start_at: `2026-10-${day}T03:00:00Z`, end_at: `2026-10-${day}T12:00:00Z`,
  status: 'planned', created_by: { id: 1, nickname: '검증 사용자' }, place_count: places.length,
  has_diary: false, completed_at: null, experience_phase: day === '13' ? 'today' : 'upcoming', record_summary: summary, places,
});
const fixtures = [
  schedule(101, '13', '성수에서 보낼 하루', [place(13, '작은 서점', 2, false), place(11, '카페 온유에서 함께 읽는 아주 긴 이름의 장소', 0, true), place(12, '서울숲', 1, false)]),
  schedule(102, '13', '저녁 약속', [place(21, '좌표 없는 장소', 0, false, false)]),
  schedule(103, '15', '갈 곳을 정할 하루', []),
  schedule(104, '16', '방문을 마친 하루', [place(31, '첫 장소', 0, true), place(32, '마지막 장소', 1, true)]),
];

const mapSdk = `window.kakao={maps:{load:cb=>cb(),LatLng:class{constructor(lat,lng){this.lat=lat;this.lng=lng;}},LatLngBounds:class{extend(){}},Map:class{constructor(element){this.element=element;window.__mapInstances=(window.__mapInstances||0)+1;element.style.background='#eff0e9';element.innerHTML='<div style="position:absolute;inset:0;background:repeating-linear-gradient(25deg,transparent 0 48px,#fff 49px 55px,transparent 56px 105px),repeating-linear-gradient(115deg,transparent 0 60px,#fff 61px 67px,transparent 68px 125px)"></div><div style="position:absolute;left:28%;top:23%;width:44%;height:28%;background:#dbe7d1;border-radius:40%"></div>';this.count=0;}relayout(){}setCenter(){}setLevel(){}setBounds(){}panBy(){}addControl(){const c=document.createElement('div');c.textContent='＋  −';c.style.cssText='position:absolute;right:10px;top:18px;padding:10px;background:white;border-radius:14px;color:#756d68';this.element.append(c);}},CustomOverlay:class{constructor({map,content}){this.content=content;const i=map.count++;content.style.position='absolute';content.style.left=[20,48,78][i%3]+'%';content.style.top=[24,40,27][i%3]+'%';map.element.append(content);}setZIndex(z){this.content.style.zIndex=z;}},ZoomControl:class{},ControlPosition:{RIGHT:1},event:{addListener(){}}}};`;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.HOME_UI_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
    await context.addInitScript(() => {
      let define;
      Object.defineProperty(window, '__d', {
        configurable: true,
        get: () => define,
        set: original => {
          define = (factory, id, dependencies, name, ...rest) => {
            if (name?.includes('ExpoSecureStore.web')) {
              factory = (_global, _require, _default, _all, module) => {
                module.exports = { __esModule: true, default: {
                  getValueWithKeyAsync: async key => key.includes('refresh') ? 'test-refresh' : 'test-access',
                  setValueWithKeyAsync: async () => {}, deleteValueWithKeyAsync: async () => {},
                } };
                window.__mockSecureStore = true;
              };
            } else if (name?.includes('expo-constants') && /Constants\.js$/.test(name)) {
              const actual = factory;
              factory = (...args) => {
                actual(...args);
                const module = args[4];
                const constants = module.exports.default;
                const override = Object.create(constants);
                Object.defineProperty(override, 'expoConfig', { value: { ...(constants.expoConfig || {}), extra: { kakaoJavaScriptKey: 'public-test-key' } } });
                module.exports.default = override;
              };
            }
            return original(factory, id, dependencies, name, ...rest);
          };
        },
      });
    });
    let failSchedules = false;
    let theme = 'rose';
    await context.route('**/api/v1/**', async route => {
      const request = route.request();
      const routePath = new URL(request.url()).pathname.replace('/api/v1', '');
      const headers = { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
      let status = request.method() === 'OPTIONS' ? 204 : 200;
      let data = {};
      if (request.method() !== 'OPTIONS') {
        if (routePath === '/auth/me') data = { id: 1, nickname: '검증 사용자', email: 'ui@example.com', default_space_id: shared.id, theme_key: theme };
        else if (routePath === '/spaces') data = { spaces: [shared, personal] };
        else if (routePath === '/menus') data = { menus: ['home', 'calendar', 'schedules', 'records', 'more'].map((code, i) => ({ code, name: ['홈', '캘린더', '일정', '기록', '더보기'][i], icon: code, children: [] })) };
        else if (/\/spaces\/[^/]+\/schedules$/.test(routePath)) {
          if (failSchedules) { status = 503; data = { code: 'TEST_FAILURE', message: '잠시 후 다시 시도해 주세요.', field: null }; }
          else data = { items: fixtures };
        } else if (routePath === '/schedules/101') data = fixtures[0];
        else if (routePath === '/schedules/101/places') data = { items: fixtures[0].places };
        else if (routePath.endsWith('/photos')) data = { photos: [] };
        else if (/\/(diaries|timeline)$/.test(routePath)) data = { items: [] };
        else if (routePath.includes('/members')) data = { members: [] };
        else if (routePath.startsWith('/spaces/')) data = shared;
      }
      await route.fulfill({ status, headers, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(data) });
    });
    await context.route('**/dapi.kakao.com/**/sdk.js?**', route => route.fulfill({ contentType: 'text/javascript', body: mapSdk }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-13T03:00:00Z') });
    await page.goto(origin + '/home');
    await expect(page.getByRole('button', { name: '성수에서 보낼 하루, 하루 상세 보기' })).toBeVisible({ timeout: 60000 });
    await expect(page.getByText('1 / 3곳 방문', { exact: true })).toBeVisible();
    await expect(page.getByText('다음 장소', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '내일', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^공간 바꾸기, 현재/ })).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.__mockSecureStore), true, 'native storage is mocked only in the browser test');
    const map = page.frameLocator('iframe[title="카카오 장소 지도"]');
    await expect(map.getByRole('button', { name: '2번 서울숲', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await map.locator('body').evaluate(() => { window.__homeMapDocument = 'initial-document'; });
    await mkdir(artifacts, { recursive: true });
    await page.waitForTimeout(600); // Let the measured sheet height and its spring settle before visual QA.
    await page.screenshot({ path: path.join(artifacts, 'home-390.png') });
    await map.getByRole('button', { name: '3번 작은 서점', exact: true }).click();
    await expect(page.getByText('선택한 장소', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '일정 목록 접기', exact: true })).toBeVisible();
    await expect(map.getByRole('button', { name: '3번 작은 서점', exact: true })).toHaveAttribute('aria-pressed', 'true');
    assert.equal(await map.locator('body').evaluate(() => window.__mapInstances), 1, 'selection must not recreate the map');
    assert.equal(await map.locator('body').evaluate(() => window.__homeMapDocument), 'initial-document', 'selection must preserve the iframe document');
    await page.getByRole('button', { name: '일정 목록 접기', exact: true }).click();
    await page.waitForTimeout(600);
    await map.getByRole('button', { name: '1번 카페 온유에서 함께 읽는 아주 긴 이름의 장소', exact: true }).click();
    await expect(page.getByText('카페 온유에서 함께 읽는 아주 긴 이름의 장소', { exact: true })).toBeVisible();
    await page.waitForTimeout(600);
    assert.equal(await map.locator('body').evaluate(() => window.__mapInstances), 1, 'a longer place card must not reload the SDK');
    assert.equal(await map.locator('body').evaluate(() => window.__homeMapDocument), 'initial-document', 'card height changes must preserve the iframe document');
    await page.getByRole('button', { name: '일정 목록 접기', exact: true }).click();
    await page.waitForTimeout(600);
    await map.getByRole('button', { name: '3번 작은 서점', exact: true }).click();
    await map.locator('body').evaluate(() => window.dispatchEvent(new MessageEvent('message', {
      source: window.parent, origin: 'https://invalid.example', data: JSON.stringify({ type: 'kakao-set-selection', id: '101:11' }),
    })));
    await expect(map.getByRole('button', { name: '3번 작은 서점', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '일정 목록 접기', exact: true }).click();
    await page.getByRole('button', { name: /^10월 14일 수요일/ }).click();
    await expect(page.getByText('이날은 예정된 하루가 없어요', { exact: true })).toBeVisible();
    await expect(map.getByText('이날 지도에 표시할 장소가 없어요', { exact: true })).toHaveCount(0);
    await expect(page.getByText('선택한 장소', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /^10월 15일 목요일/ }).click();
    await expect(page.getByText('아직 장소가 없어요', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^10월 16일 금요일/ }).click();
    await expect(page.getByText('모든 장소 방문 완료', { exact: true })).toBeVisible();
    await expect(page.getByText('다음 장소', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /^10월 13일 화요일/ }).click();
    await page.setViewportSize({ width: 320, height: 568 });
    const open = page.getByRole('button', { name: '성수에서 보낼 하루, 하루 상세 보기' });
    await expect(open).toBeInViewport({ timeout: 10000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(artifacts, 'home-320.png') });
    await open.click();
    await expect(page).toHaveURL(/\/schedules\/101$/);
    theme = 'blue';
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + '/home');
    await expect(page.getByRole('button', { name: '성수에서 보낼 하루, 하루 상세 보기' })).toHaveCSS('background-color', 'rgb(71, 116, 158)');
    failSchedules = true;
    await page.reload();
    await expect(page.getByText('하루를 불러오지 못했어요', { exact: true })).toBeVisible({ timeout: 15000 });
    failSchedules = false;
    await page.getByText('다시 시도', { exact: true }).click();
    await expect(page.getByText('1 / 3곳 방문', { exact: true })).toBeVisible();
    assert.deepEqual(errors, [], 'screen must not emit unhandled browser errors');
    console.log('Home UI: 390/320px, marker/card synchronization, date/empty/all-visited states, detail navigation, theme and retry passed.');
    console.log('Screenshots: ' + artifacts);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
