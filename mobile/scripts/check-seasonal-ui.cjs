// 크리스마스 배경 A "눈 오는 골목"을 실제 Expo 화면으로 확인한다.
// API·SecureStore는 가짜로 바꿔 끼우므로 실제 서버에는 아무것도 쓰지 않는다.
// 8081에 Expo 웹 개발 서버가 떠 있어야 한다 (npx expo start --web --port 8081).
//
// 확인하는 것
// 1. 낮(12-14 12시)과 밤(12-14 21시)에 일정·기록·더보기가 화면 전체 장면을 입는다
// 2. 밤에는 카드 밖 글씨가 흰색 계열이 된다
// 3. 칩 ×로 끄면 PATCH {seasonal_background_enabled:false}가 나가고 장면이 사라지며
//    "되돌리기"를 누르면 다시 켜진다
// 4. 더보기 "사용자 설정"에서 밤을 고르면 PATCH {seasonal_background_time:"night"}가 나간다
// 5. 기간 밖(12-27)에는 장면도 더보기 설정 줄도 없다
const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdir } = require('node:fs/promises');
const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');

const origin = process.env.SEASONAL_UI_ORIGIN || 'http://localhost:8081';
const artifacts = path.resolve(process.env.SEASONAL_UI_ARTIFACTS || path.join(__dirname, '../dist-seasonal-check/screenshots'));
const shared = { id: '22222222-2222-4222-8222-222222222222', name: '우리의 공간', type: 'shared', my_role: 'owner', member_count: 2, is_default: true, join_code: 'K7M2QX9P' };
const summary = { has_content: false, has_diary_text: false, photo_count: 0, timeline_count: 0, cover_thumbnail_url: null, diary_excerpt: null };
const schedule = (id, day, title, phase) => ({
  id, space_id: shared.id, space_name: shared.name, title, description: null,
  start_at: `2026-12-${day}T09:00:00Z`, end_at: `2026-12-${day}T13:00:00Z`,
  status: 'planned', created_by: { id: 1, nickname: '하루' }, place_count: 0,
  has_diary: false, completed_at: null, experience_phase: phase, record_summary: summary, places: [],
});
const fixtures = [schedule(201, '24', '크리스마스이브 저녁', 'upcoming'), schedule(202, '25', '성수 카페 투어', 'upcoming')];
const feed = [{
  schedule_id: 101, title: '첫눈 오던 날', start_at: '2026-12-05T05:00:00Z', end_at: '2026-12-05T10:00:00Z', sorted_at: '2026-12-05T10:00:00Z',
  completed_at: '2026-12-05T10:00:00Z', experience_phase: 'completed', place_count: 2, authors: [{ id: 1, nickname: '하루' }],
  record_summary: { ...summary, has_content: true, has_diary_text: true, diary_excerpt: '눈이 와서 계획보다 천천히 걸었다. 그래도 좋았다.' },
}];

async function openContext(browser, user, patches) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', hasTouch: true });
  // 다른 확인 스크립트(check-home-ui.cjs)와 같은 방법으로 SecureStore를 가짜로 바꿔 로그인 상태를 만든다.
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
    let data = {};
    if (request.method() === 'PATCH' && routePath === '/users/me') {
      const body = request.postDataJSON();
      patches.push(body);
      Object.assign(user, body);
      data = user;
    } else if (request.method() !== 'OPTIONS') {
      if (routePath === '/auth/me') data = user;
      else if (routePath === '/spaces') data = { spaces: [shared] };
      else if (routePath === '/menus') data = { menus: ['home', 'calendar', 'schedules', 'records', 'more'].map((code, i) => ({ code, name: ['홈', '캘린더', '일정', '기록', '더보기'][i], icon: code, children: [] })) };
      else if (/\/spaces\/[^/]+\/schedules$/.test(routePath)) data = { items: fixtures };
      else if (/\/spaces\/[^/]+\/diaries$/.test(routePath)) data = { items: feed, next_cursor: null };
      else if (routePath.startsWith('/spaces/')) data = shared;
    }
    await route.fulfill({ status, headers, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(data) });
  });
  return context;
}

const baseUser = () => ({
  id: 1, nickname: '하루', email: 'ui@example.com', default_space_id: shared.id, theme_key: 'rose',
  seasonal_background_enabled: true, seasonal_background_time: 'auto', created_at: '2026-08-01T00:00:00Z',
});

async function shoot(page, name) {
  // 눈이 멈춘 한 장면을 찍는다. 시계를 멈춰 두었으므로 매번 같은 자리다.
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
}

(async () => {
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SEASONAL_UI_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [label, time] of [['day', '2026-12-14T03:00:00Z'], ['night', '2026-12-14T12:00:00Z']]) {
      const user = baseUser();
      const patches = [];
      const context = await openContext(browser, user, patches);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date(time) });

      await page.goto(origin + '/schedules');
      await expect(page.getByText('하루님, 메리 크리스마스')).toBeVisible({ timeout: 60000 });
      await expect(page.getByText('크리스마스까지 D-11')).toBeVisible();
      await expect(page.getByText('크리스마스이브 저녁')).toBeVisible();
      const titleColor = await page.getByRole('heading', { name: '일정' }).evaluate(el => getComputedStyle(el).color);
      assert.equal(titleColor === 'rgb(255, 255, 255)', label === 'night', `${label} 일정 제목 색 ${titleColor}`);
      await shoot(page, `${label}-schedules`);

      await page.goto(origin + '/records');
      await expect(page.getByText('첫눈 오던 날')).toBeVisible({ timeout: 30000 });
      await shoot(page, `${label}-records`);

      await page.goto(origin + '/more');
      await expect(page.getByText('12월 26일까지만 보여요')).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('7시~18시는 낮, 그 밖은 밤으로 바뀌어요')).toBeVisible();
      await shoot(page, `${label}-more-top`);
      await page.getByText('사용자 설정', { exact: true }).scrollIntoViewIfNeeded();
      await shoot(page, `${label}-more-settings`);
      // 맨 아래까지 내린 상태. 마지막 글씨가 흰 눈밭이 아니라 건물 위에서 끝나야 한다.
      await page.getByText('계획한 하루가, 소중한 기억으로.').evaluate(element => {
        let node = element.parentElement;
        while (node && !(node.scrollHeight > node.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(node).overflowY))) node = node.parentElement;
        if (node) node.scrollTop = node.scrollHeight;
      });
      await shoot(page, `${label}-more-bottom`);

      if (label === 'day') {
        // 사용자 설정에서 밤을 고르면 저장되고 장면이 밤으로 바뀐다.
        await page.getByRole('radio', { name: '밤' }).click();
        await expect.poll(() => patches.at(-1)).toEqual({ seasonal_background_time: 'night' });
        await expect(page.getByText('시간과 상관없이 늘 밤으로 보여요')).toBeVisible();
        await page.getByRole('radio', { name: '자동' }).click();
        await expect.poll(() => patches.at(-1)).toEqual({ seasonal_background_time: 'auto' });

        // 칩 ×로 끄고 되돌리기.
        await page.goto(origin + '/schedules');
        await page.getByRole('button', { name: '크리스마스 배경 끄기' }).click();
        await expect.poll(() => patches.at(-1)).toEqual({ seasonal_background_enabled: false });
        await expect(page.getByText('하루님, 메리 크리스마스')).toHaveCount(0);
        await expect(page.getByText('크리스마스 배경을 껐어요. 더보기에서 다시 켤 수 있어요.')).toBeVisible();
        await shoot(page, 'day-schedules-off');
        await page.getByRole('button', { name: '되돌리기' }).click();
        await expect.poll(() => patches.at(-1)).toEqual({ seasonal_background_enabled: true });
        await expect(page.getByText('하루님, 메리 크리스마스')).toBeVisible();
      }

      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${label}: schedules, records and more screens wear the scene.`);
    }

    // 기간 밖: 장면도 설정 줄도 없다.
    const context = await openContext(browser, baseUser(), []);
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-12-27T03:00:00Z') });
    await page.goto(origin + '/more');
    await expect(page.getByText('테마', { exact: true })).toBeVisible({ timeout: 60000 });
    await expect(page.getByText('크리스마스 배경')).toHaveCount(0);
    await expect(page.getByText('하루님, 메리 크리스마스')).toHaveCount(0);
    await context.close();
    console.log('after season: no scene, no settings rows.');
    console.log(`screenshots: ${artifacts}`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
