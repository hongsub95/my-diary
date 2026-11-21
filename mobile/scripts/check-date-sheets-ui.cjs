// 날짜 시트 세 가지(하루 A·기간 B·홈 월간 C)를 실제 Expo 화면으로 확인한다.
// API·SecureStore는 가짜로 바꿔 끼우므로 실제 서버에는 아무것도 쓰지 않는다.
// Expo 웹 개발 서버가 떠 있어야 한다 (기본 8081, DATE_UI_ORIGIN으로 바꿀 수 있다).
//
// 확인하는 것
// 1. 캘린더 주간 보기에서 날짜 이동 → 하루 시트(A): 날짜를 누르면 바로 정해지고 닫힌다
// 2. 캘린더 월간 보기에서 달 이동 → 달 고르기
// 3. 하루 만들기의 날짜 → 기간 시트(B): 첫 탭 시작, 둘째 탭 끝, 요약에 "1박 2일"
// 4. 홈 달 이름 → 월간 시트(C): 하루 상태 점과 "이 주 보기"
// 5. 공휴일(성탄절) 이름이 칸에 보이고 칸 이름으로도 읽힌다
const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdir } = require('node:fs/promises');
const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');

const origin = process.env.DATE_UI_ORIGIN || 'http://localhost:8081';
const artifacts = path.resolve(process.env.DATE_UI_ARTIFACTS || path.join(__dirname, '../dist-date-sheets-check/screenshots'));
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
  const browser = await chromium.launch({ headless: true, executablePath: process.env.DATE_UI_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
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

    // 1. 캘린더 주간 보기 → 하루 시트(A)
    await page.goto(origin + '/calendar');
    await page.getByRole('tab', { name: '주간' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: /날짜 이동 선택창 열기/ }).click();
    await expect(page.getByText('날짜를 누르면 바로 정해져요')).toBeVisible();
    await expect(page.getByText('성탄절')).toBeVisible();
    await expect(page.getByRole('button', { name: /^2026년 12월 25일 금요일, 성탄절/ })).toBeVisible();
    await shot('a-date-sheet');
    await page.getByRole('button', { name: /^2026년 12월 24일 목요일/ }).click();
    await expect(page.getByText('날짜를 누르면 바로 정해져요')).toHaveCount(0);
    console.log('A: tapping a day picks it and closes the sheet.');

    // 2. 캘린더 월간 보기 → 달 고르기
    await page.getByRole('tab', { name: '월간' }).click();
    await page.getByRole('button', { name: /날짜 이동 선택창 열기/ }).click();
    await expect(page.getByRole('button', { name: '2026년 11월', exact: true })).toBeVisible();
    await shot('a-month-pick');
    await page.getByRole('button', { name: '2026년 11월', exact: true }).click();
    await expect(page.getByRole('button', { name: '2026년 11월', exact: true })).toHaveCount(0);
    console.log('A(month): picking a month closes the sheet.');

    // 3. 하루 만들기 → 기간 시트(B)
    await page.goto(origin + '/schedules/new?date=2026-12-14');
    await page.getByRole('button', { name: /^날짜, / }).click({ timeout: 60000 });
    await expect(page.getByText('12월 14일 (월) · 당일')).toBeVisible();
    // 처음 열면 지금 기간이 있는 달이 맨 위에 와야 한다. 시트가 올라오는 애니메이션(220ms)이 끝난 뒤에 잰다.
    await page.waitForTimeout(400);
    const decemberTitle = await page.getByText('2026년 12월', { exact: true }).boundingBox();
    const summaryBox = await page.getByText('12월 14일 (월) · 당일').boundingBox();
    await shot('b-range-open');
    assert.ok(decemberTitle.y - summaryBox.y < 80, `12월이 요약 바로 아래에 와야 한다 (간격 ${decemberTitle.y - summaryBox.y})`);
    await page.getByRole('button', { name: /^2026년 12월 24일 목요일/ }).click();
    await expect(page.getByText('끝나는 날을 누르거나, 하루만이면 바로 적용하세요')).toBeVisible();
    await page.getByRole('button', { name: /^2026년 12월 26일 토요일/ }).click();
    await expect(page.getByText(/12월 24일 \(목\) – 12월 26일 \(토\) · 2박 3일/)).toBeVisible();
    await shot('b-range-sheet');
    await page.getByRole('button', { name: /적용하기$/ }).click();
    await expect(page.getByRole('button', { name: /^날짜, .*2박 3일/ })).toBeVisible();
    console.log('B: two taps make a range and the form shows 2박 3일.');

    // 4. 홈 → 월간 시트(C)
    await page.goto(origin + '/home');
    await page.getByRole('button', { name: '2026년 12월, 월 선택 열기', exact: true }).click({ timeout: 60000 });
    await expect(page.getByRole('button', { name: '이 주 보기', exact: true })).toBeVisible();
    await expect(page.getByText('남기기 전')).toBeVisible();
    await shot('c-month-sheet');
    await page.getByRole('button', { name: /^2026년 12월 24일 목요일/ }).click();
    await page.getByRole('button', { name: '이 주 보기', exact: true }).click();
    await expect(page.getByRole('button', { name: /^12월 24일 목요일/ })).toBeInViewport({ ratio: 0.9 });
    console.log('C: picking a day moves the home week.');

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
