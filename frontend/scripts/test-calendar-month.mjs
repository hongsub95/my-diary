// 캘린더 탭 월간 막대 달력과 그날 서랍을 웹 화면으로 확인한다. API는 가짜로 바꿔 끼운다.
// 실행: 개발 서버를 띄운 뒤(npx vite --port 5190 --strictPort) node scripts/test-calendar-month.mjs
//
// 확인하는 것
// 1. 여러 날 하루(24~26일)가 이어진 막대 하나로 보이고 막대 모양(옅은 바탕 + 왼쪽 색 줄)이다
// 2. 오늘(14일)은 숫자 색만 테마 색이고 배경이 없다
// 3. 날짜를 누르면 서랍이 오른쪽에서 열리고, 오른쪽으로 밀면 닫힌다
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const origin = process.env.CAL_UI_ORIGIN ?? 'http://127.0.0.1:5190'
const artifacts = path.resolve(process.env.CAL_UI_ARTIFACTS ?? 'test-results/calendar-month')
const space = { id: '11111111-1111-4111-8111-111111111111', name: '우리의 공간', type: 'shared', my_role: 'owner', member_count: 2, is_default: true }
const summary = { has_content: false, has_diary_text: false, photo_count: 0, timeline_count: 0, cover_thumbnail_url: null, diary_excerpt: null }
const schedule = (id, start, end, title, phase) => ({
  id, space_id: space.id, space_name: space.name, title, description: null,
  start_at: `${start}T03:00:00Z`, end_at: `${end}T09:00:00Z`, status: 'planned', created_by: { id: 1, nickname: '하루' },
  place_count: 0, has_diary: false, completed_at: null, experience_phase: phase, record_summary: summary, places: [],
})
const schedules = [
  schedule(301, '2026-12-05', '2026-12-05', '첫눈 산책', 'recorded'),
  schedule(302, '2026-12-10', '2026-12-10', '전시 보기', 'record_pending'),
  schedule(303, '2026-12-24', '2026-12-26', '크리스마스 여행', 'upcoming'),
]

await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.CAL_UI_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.clock.install({ time: new Date('2026-12-14T03:00:00Z') })
  await page.route('**/api/v1/**', async route => {
    const req = route.request()
    const routePath = new URL(req.url()).pathname.replace('/api/v1', '')
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' }
    let status = 200
    let data = { items: [], next_cursor: null }
    if (req.method() === 'OPTIONS') status = 204
    // 계절 배경은 꺼 둔다. 달력만 본다.
    else if (routePath === '/auth/me') data = { id: 1, nickname: '하루', email: 'ui@example.com', default_space_id: space.id, theme_key: 'rose', seasonal_background_enabled: false, seasonal_background_time: 'auto', created_at: '2026-08-01T00:00:00Z' }
    else if (routePath === '/spaces') data = { spaces: [space] }
    else if (routePath === `/spaces/${space.id}`) data = space
    else if (routePath === '/menus') data = { menus: ['home', 'calendar', 'schedules', 'records', 'more'].map((code, i) => ({ code, name: ['홈', '캘린더', '일정', '기록', '더보기'][i], icon: code, children: [] })) }
    else if (/\/spaces\/[^/]+\/schedules$/.test(routePath)) data = { items: schedules }
    else if (routePath === '/calendar/holidays') data = { year: 2026, coverage: 'complete', days: [{ date: '2026-12-25', names: ['성탄절'], kind: 'public' }], months: [] }
    await route.fulfill({ status, headers, ...(status === 204 ? {} : { contentType: 'application/json', body: JSON.stringify(data) }) })
  })

  await page.goto(origin + '/calendar')
  const trip = page.locator('.product-calendar__event', { hasText: '크리스마스 여행' })
  await expect(trip).toHaveCount(1, { timeout: 30000 })
  const tripStyle = await trip.evaluate(el => { const s = getComputedStyle(el); return { bg: s.backgroundColor, line: s.borderLeftColor, width: el.getBoundingClientRect().width } })
  assert.equal(tripStyle.bg, 'rgb(251, 236, 239)')
  assert.equal(tripStyle.line, 'rgb(207, 82, 107)')
  assert.ok(tripStyle.width > 120, `세 날에 걸친 막대 폭 ${tripStyle.width}`)
  const today = page.locator('.product-calendar__cell--today .product-calendar__day-number')
  const todayStyle = await today.evaluate(el => { const s = getComputedStyle(el); return { color: s.color, bg: s.backgroundColor } })
  assert.equal(todayStyle.color, 'rgb(207, 82, 107)')
  assert.ok(todayStyle.bg === 'rgba(0, 0, 0, 0)' || todayStyle.bg === 'transparent', `오늘 바탕 ${todayStyle.bg}`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(artifacts, 'month.png') })
  console.log('Month: multi-day bar is one piece with bar style, today is number color only.')

  await page.getByText('17', { exact: true }).click()
  const drawer = page.getByRole('dialog', { name: '12월 17일 일정' })
  await expect(drawer).toBeVisible()
  await page.waitForTimeout(300)
  const box = await drawer.boundingBox()
  const layout = await page.locator('.calendar-page').boundingBox()
  assert.ok(Math.abs(box.x + box.width - (layout.x + layout.width)) < 2, '서랍은 오른쪽 끝에 붙는다')
  await page.screenshot({ path: path.join(artifacts, 'drawer.png') })
  // 서랍 안에서 오른쪽으로 민다.
  const y = box.y + 300
  await page.mouse.move(box.x + 40, y)
  await page.mouse.down()
  for (let dx = 20; dx <= box.width * 0.6; dx += 20) await page.mouse.move(box.x + 40 + dx, y + 2)
  await page.mouse.up()
  await expect(drawer).toHaveCount(0)
  console.log('Drawer: opens from the right and closes with a right swipe.')

  assert.deepEqual(errors, [])
  await context.close()
  console.log(`screenshots: ${artifacts}`)
} finally {
  await browser.close()
}
