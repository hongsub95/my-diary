// 하루 만들기·고치기·지우기 흐름의 화면 이동을 실제 Expo 화면에서 확인한다.
//
// 확인하는 것: 하루를 다 만들면 일정 탭으로 나오고, 그 뒤 뒤로 가도 만들기 단계로
// 되돌아가지 않는다. 홈에서 시작해도, 코스 추천 화면에 다녀와도 같다. 고치기·지우기를
// 마친 뒤에도 지난 화면이 겹쳐 남지 않는다. 화면 이동은 스택에 무엇이 쌓였는지가
// 핵심이라, 주소창만 보지 않고 expo-router의 실제 스택을 읽어 비교한다.
//
// 실행: npm run check:create-flow
//
// 기존 Expo 웹 개발 서버(8081)가 떠 있어야 한다. API는 브라우저에서 가로채 모의 응답을
// 주므로 실제 서버에는 아무것도 쓰지 않는다.
const assert = require('node:assert/strict');
const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');

const origin = process.env.CREATE_FLOW_ORIGIN || 'http://localhost:8081';
const space = { id: '22222222-2222-4222-8222-222222222222', name: '우리의 공간', type: 'shared', my_role: 'owner', member_count: 2, is_default: true, join_code: 'K7M2QX9P' };
const summary = { has_content: false, has_diary_text: false, photo_count: 0, timeline_count: 0, cover_thumbnail_url: null, diary_excerpt: null };
const created = {
  id: 201, space_id: space.id, space_name: space.name, title: '성수 산책', description: null,
  start_at: '2026-10-13T03:00:00Z', end_at: '2026-10-13T06:00:00Z', status: 'planned',
  created_by: { id: 1, nickname: '검증 사용자' }, place_count: 0, has_diary: false, completed_at: null,
  experience_phase: 'upcoming', record_summary: summary, places: null,
};
const options = {
  categories: [{ code: 'cafe', label: '카페·디저트', subcategories: [{ code: 'any', label: '상관없음' }] }],
  radius_options_m: [1000], default_radius_m: 1000, party_sizes: [{ code: '2', label: '2명' }],
  default_item_count: 1, max_item_count: 6, basis: 'straight_line',
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CREATE_FLOW_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' });
    // 네이티브 보안 저장소는 브라우저에 없어 가짜 토큰을 돌려준다. expo-router의 스택
    // 저장소는 화면 이동 결과를 읽으려고 window에 걸어 둔다.
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
            } else if (/expo-router[\\/]build[\\/]global-state[\\/]store\.js$/.test(name ?? '')) {
              const actual = factory;
              factory = (...args) => {
                actual(...args);
                window.__routerStore = args[4].exports.store;
              };
            }
            return original(factory, id, dependencies, name, ...rest);
          };
        },
      });
    });
    // 모의 서버의 하루 한 건. 만들기·고치기·지우기가 이 값을 바꾼다.
    let made = false;
    let deleted = false;
    let current = { ...created };
    await context.route('**/api/v1/**', async route => {
      const request = route.request();
      const method = request.method();
      const routePath = new URL(request.url()).pathname.replace(/^.*\/api\/v1/, '');
      const headers = { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
      let status = 200;
      let data = {};
      if (routePath === '/auth/me') data = { id: 1, nickname: '검증 사용자', email: 'ui@example.com', default_space_id: space.id, theme_key: 'rose' };
      else if (routePath === '/spaces') data = { spaces: [space] };
      else if (routePath === '/menus') data = { menus: ['home', 'calendar', 'schedules', 'records', 'more'].map((code, i) => ({ code, name: ['홈', '캘린더', '일정', '기록', '더보기'][i], icon: code, children: [] })) };
      else if (routePath === `/spaces/${space.id}/schedules` && method === 'POST') { made = true; deleted = false; current = { ...created }; status = 201; data = current; }
      else if (routePath === `/spaces/${space.id}/schedules`) data = { items: made && !deleted ? [current] : [] };
      else if (routePath === '/schedules/201' && method === 'DELETE') { deleted = true; return route.fulfill({ status: 204, headers }); }
      else if (routePath === '/schedules/201' && deleted) { status = 404; data = { code: 'SCHEDULE_NOT_FOUND', message: '일정을 찾을 수 없습니다.', field: null }; }
      else if (routePath === '/schedules/201' && method === 'PATCH') { current = { ...current, ...request.postDataJSON() }; data = current; }
      else if (routePath === '/schedules/201') data = current;
      else if (routePath === '/schedules/201/places') data = { items: [] };
      else if (routePath === '/recommendation-options') data = options;
      else if (routePath.endsWith('/photos')) data = { photos: [] };
      else if (/\/(diaries|timeline)$/.test(routePath)) data = { items: [] };
      else if (routePath.includes('/members')) data = { members: [] };
      else if (routePath.startsWith('/spaces/')) data = space;
      await route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
    });

    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-13T03:00:00Z') });

    /** 지금 루트 스택에 쌓인 화면 이름. 탭 묶음은 지금 보고 있는 탭까지 함께 적는다. */
    const stack = () => page.evaluate(() => {
      // expo-router는 앱의 Stack을 `__root` 화면 하나로 한 번 더 감싼다. 그 안이 실제 스택이다.
      let root = window.__routerStore.navigationRef.getRootState();
      while (root.routes.length === 1 && root.routes[0].name === '__root' && root.routes[0].state) {
        root = root.routes[0].state;
      }
      return root.routes.map(route => {
        const nested = route.state;
        return nested ? `${route.name}/${nested.routes[nested.index ?? 0].name}` : route.name;
      });
    });

    /** 1단계를 채워 저장하고 2단계 화면까지 간다. */
    async function fillStepOne() {
      await page.getByRole('textbox', { name: '하루의 이름, 필수' }).fill('성수 산책');
      await page.getByText(/갈 곳 정하기/).click();
      await expect(page).toHaveURL(/\/schedules\/201\/plan$/, { timeout: 15000 });
    }

    /** 일정 탭의 ＋에서 하루를 만들어 2단계 화면까지 간다. */
    async function openPlanFromSchedulesTab() {
      await page.goto(origin + '/schedules');
      await page.getByRole('button', { name: '새 일정 만들기' }).click();
      await fillStepOne();
    }

    /**
     * 화면이 바뀐 뒤의 스택을 남긴다.
     *
     * 웹에서는 뒤에 깔린 화면도 DOM에 남아 있어 같은 이름의 버튼이 여럿 잡힐 수 있다.
     * 그래서 버튼은 맨 위 화면의 것(마지막)을 누르고, 결과는 주소가 아니라 스택으로 본다.
     */
    async function settle(label) {
      await page.waitForTimeout(300);
      const after = await stack();
      console.log(`${label} → ${new URL(page.url()).pathname}, 스택:`, after);
      return after;
    }

    /**
     * 2단계에서 끝내고, 어디로 갔는지와 스택을 남긴다.
     *
     * 주소부터 단정하지 않고 "2단계를 벗어났다"까지만 기다린다. 잘못된 곳으로 갔을 때도
     * 그때의 스택을 출력해야 무엇이 쌓였는지 볼 수 있다.
     */
    async function finish(label) {
      await page.getByRole('button', { name: '장소 없이 끝내기' }).click();
      await expect(page).not.toHaveURL(/\/plan$/, { timeout: 15000 });
      return settle(label);
    }

    // 0) 홈에서 시작해도 끝나면 일정 탭으로 나온다. 시작한 탭과 달라도 탭이 바뀌어야 한다.
    //    홈의 빈 날짜 카드가 보이려면 아직 하루가 없어야 해서 맨 먼저 확인한다.
    await page.goto(origin + '/home');
    await page.getByText('새 하루 만들기 →').click();
    await fillStepOne();
    const fromHome = await finish('홈에서 시작해 끝냄');
    await expect(page).toHaveURL(/\/schedules$/);
    assert.deepEqual(fromHome, ['(tabs)/schedules'], '홈에서 시작해도 끝내면 일정 탭만 남아야 한다');

    // 1) 일정 탭에서 시작해 장소 없이 바로 끝낸다.
    await openPlanFromSchedulesTab();
    const plain = await finish('바로 끝냄');
    await expect(page).toHaveURL(/\/schedules$/);
    assert.deepEqual(plain, ['(tabs)/schedules'], '끝내면 일정 탭만 남아야 한다');

    // 2) 코스 추천 화면에 다녀온 뒤 끝낸다. 예전에는 추천 화면이 2단계를 새로 하나 더
    //    쌓아서, 끝낸 뒤 뒤로 가면 2단계로 돌아갔다.
    await openPlanFromSchedulesTab();
    await page.getByRole('button', { name: /코스 추천받기/ }).click();
    await expect(page).toHaveURL(/\/schedules\/201\/recommendations/, { timeout: 15000 });
    await page.getByRole('button', { name: '일정으로 돌아가기' }).click();
    await expect(page).toHaveURL(/\/schedules\/201\/plan$/, { timeout: 15000 });
    console.log('추천에서 돌아온 뒤 스택:', await stack());
    const viaRecommendation = await finish('추천을 거쳐 끝냄');
    await expect(page).toHaveURL(/\/schedules$/);
    assert.deepEqual(viaRecommendation, ['(tabs)/schedules'], '추천에 다녀와도 끝내면 일정 탭만 남아야 한다');

    /** 일정 탭에서 방금 만든 하루의 상세를 연다. */
    async function openDetail() {
      await page.goto(origin + '/schedules');
      await page.getByText(current.title, { exact: true }).first().click();
      await expect(page).toHaveURL(/\/schedules\/201$/, { timeout: 15000 });
    }
    const detailStack = ['(tabs)/schedules', 'schedules/[id]'];

    // 3) 일정 고치기에서 저장하면 상세로 돌아오고, 상세가 두 겹이 되지 않는다.
    await openDetail();
    await page.getByRole('button', { name: '일정 고치기' }).click();
    await expect(page).toHaveURL(/\/schedules\/201\/edit$/, { timeout: 15000 });
    await page.getByRole('textbox', { name: '하루의 이름, 필수' }).last().fill('성수 산책 다시');
    await page.getByRole('button', { name: '저장하기' }).click();
    await expect(page).toHaveURL(/\/schedules\/201(\?.*)?$/, { timeout: 15000 });
    assert.deepEqual(await settle('고쳐서 저장'), detailStack, '저장하면 상세 하나만 남아야 한다');

    // 4) 고치지 않고 뒤로 가도 상세가 두 겹이 되지 않는다.
    await page.getByRole('button', { name: '일정 고치기' }).click();
    await expect(page).toHaveURL(/\/schedules\/201\/edit$/, { timeout: 15000 });
    await page.getByRole('button', { name: '뒤로 가기' }).last().click();
    await expect(page).toHaveURL(/\/schedules\/201(\?.*)?$/, { timeout: 15000 });
    assert.deepEqual(await settle('고치기에서 뒤로'), detailStack, '뒤로 가면 상세 하나만 남아야 한다');

    // 5) 지우면 일정 탭으로 나오고, 지운 하루의 상세가 아래에 남지 않는다.
    await page.getByRole('button', { name: '일정 지우기' }).click();
    await expect(page).toHaveURL(/\/schedules\/201\/delete$/, { timeout: 15000 });
    await page.getByRole('button', { name: '일정 지우기' }).last().click();
    await expect(page).toHaveURL(/\/schedules$/, { timeout: 15000 });
    assert.deepEqual(await settle('지운 뒤'), ['(tabs)/schedules'], '지우면 일정 탭만 남아야 한다');

    assert.deepEqual(errors, [], '화면에 처리되지 않은 오류가 없어야 한다');
    console.log('하루 만들기·고치기·지우기 흐름: 끝난 뒤 스택에 지난 단계가 남지 않음 통과');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
