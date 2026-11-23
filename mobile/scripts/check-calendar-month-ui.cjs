// 캘린더 탭 월간 막대 달력과 그날 서랍을 실제 Expo 화면으로 확인한다.
// API·SecureStore는 가짜로 바꿔 끼우므로 실제 서버에는 아무것도 쓰지 않는다.
// Expo 웹 개발 서버가 떠 있어야 한다 (기본 8081, CAL_UI_ORIGIN으로 바꿀 수 있다).
//
// 확인하는 것
// 1. 여러 날 하루(24~26일)가 이어진 막대 하나로, 한 날 하루는 짧은 막대로 보인다
// 2. 오늘(14일)은 숫자 색만 테마 색이다(배경·테두리 없음)
// 3. 날짜를 누르면 그날 서랍이 오른쪽에서 열리고, 오른쪽으로 밀면 닫힌다
const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdir } = require('node:fs/promises');
const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');

const origin = process.env.CAL_UI_ORIGIN || 'http://localhost:8081';
const artifacts = path.resolve(process.env.CAL_UI_ARTIFACTS || path.join(__dirname, '../dist-calendar-month-check/screenshots'));
const space = { id: '22222222-2222-4222-8222-222222222222', name: '우리의 공간', type: 'shared', my_role: 'owner', member_count: 2, is_default: true, join_code: 'K7M2QX9P' };
const summary = { has_content: false, has_diary_text: false, photo_count: 0, timeline_count: 0, cover_thumbnail_url: null, diary_excerpt: null };
const schedule = (id, start, end, title, phase) => ({
  id, space_id: space.id, space_name: space.name, title, description: null,
  start_at: `${start}T09:00:00Z`, end_at: `${end}T09:00:00Z`, status: 'planned', created_by: { id: 1, nickname: '하루' },
  place_count: 0, has_diary: false, completed_at: null, experience_phase: phase, record_summary: summary, places: [],
});
const schedules = [
  schedule(301, '2026-12-05', '2026-12-05', '첫눈 산책', 'recorded'),
  schedule(302, '2026-12-10', '2026-12-10', '전시 보기', 'record_pending'),
  schedule(303, '2026-12-24', '2026-12-26', '크리스마스 여행', 'upcoming'),
];

(async () => {
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CAL_UI_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', hasTouch: true });
    // 다른 확인 스크립트와 같은 방법으로 SecureStore를 가짜로 바꿔 로그인 상태를 만든다.
    await context.addInitScript(() => {
      let define;
      Object.defineProperty(window, '__d', {
        configurable: true,
        get: () => define,
        set: original => {
          define = (factory, id, dependencies, name, ...rest) => {
            if (name?.includes('ExpoSecureStore.web')) {
              factory = (_g, _r, _d, _a, module) => {
                module.exports = { __esModule: true, default: {
                  getValueWithKeyAsync: async key => key.includes('refresh') ? 'test-refresh' : 'test-access',
                  setValueWithKeyAsync: async () => {}, deleteValueWithKeyAsync: async () => {},
                } };
              };
            }
            return original(factory, id, dependencies, name, ...rest);
          };
        },
      });
    });
    await context.route('**/api/v1/**', async route => {
      const request = route.request();
      const routePath = new URL(request.url()).pathname.replace('/api/v1', '');
      const headers = { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' };
      let status = request.method() === 'OPTIONS' ? 204 : 200;
      let data = { items: [], next_cursor: null };
      if (request.method() !== 'OPTIONS') {
        // 계절 배경은 꺼 둔다. 날짜 시트만 본다.
        if (routePath === '/auth/me') data = { id: 1, nickname: '하루', email: 'ui@example.com', default_space_id: space.id, theme_key: 'rose', seasonal_background_enabled: false, seasonal_background_time: 'auto', created_at: '2026-08-01T00:00:00Z' };
        else if (routePath === '/spaces') data = { spaces: [space] };
        else if (routePath === '/menus') data = { menus: ['home', 'calendar', 'schedules', 'records', 'more'].map((code, i) => ({ code, name: ['홈', '캘린더', '일정', '기록', '더보기'][i], icon: code, children: [] })) };
        else if (routePath === '/calendar/holidays') data = { days: [{ date: '2026-12-25', names: ['성탄절'] }] };
        else if (/\/spaces\/[^/]+\/schedules$/.test(routePath)) data = { items: schedules };
        else if (routePath.startsWith('/spaces/')) data = space;
      }
      await route.fulfill({ status, headers, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(data) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-12-14T03:00:00Z') });
    const shot = async name => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(artifacts, `${name}.png`) }); };

    await page.goto(origin + '/calendar');
    await expect(page.getByText('크리스마스 여행', { exact: true })).toHaveCount(1, { timeout: 60000 });
    await expect(page.getByText('첫눈 산책', { exact: true })).toBeVisible();
    // 오늘은 숫자만 테마 색(로즈 #CF526B)
    const today = page.getByRole('button', { name: /^12월 14일 월요일, 오늘/ });
    const todayColor = await today.getByText('14', { exact: true }).evaluate(el => getComputedStyle(el).color);
    assert.equal(todayColor, 'rgb(207, 82, 107)');
    const todayBg = await today.evaluate(el => getComputedStyle(el).backgroundColor);
    assert.ok(todayBg === 'rgba(0, 0, 0, 0)' || todayBg === 'transparent', `오늘 칸 바탕 ${todayBg}`);
    await shot('month');
    console.log('Month: multi-day bar is one piece, today is number color only.');

    await page.getByRole('button', { name: /^12월 24일 목요일/ }).click();
    const close = page.getByRole('button', { name: '닫기', exact: true });
    await expect(close).toBeVisible();
    await page.waitForTimeout(300);
    const box = await page.getByText('이날의 하루', { exact: false }).first().boundingBox();
    const viewport = page.viewportSize();
    assert.ok(box.x > viewport.width * 0.1, `서랍은 오른쪽에 붙는다 (x ${box.x})`);
    await shot('drawer');
    // 서랍 안에서 오른쪽으로 민다.
    await page.mouse.move(viewport.width * 0.4, 420);
    await page.mouse.down();
    for (let x = 0.4; x <= 0.95; x += 0.05) await page.mouse.move(viewport.width * x, 424, { steps: 2 });
    await page.mouse.up();
    await expect(close).toHaveCount(0, { timeout: 5000 });
    console.log('Drawer: opens from the right and closes with a right swipe.');

    assert.deepEqual(errors, []);
    await context.close();
    console.log(`screenshots: ${artifacts}`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
