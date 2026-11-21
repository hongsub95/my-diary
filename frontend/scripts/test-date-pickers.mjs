// Real web + Expo screens; API fixtures never write to the user's data.
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const web = process.env.PICKER_WEB_ORIGIN || 'http://127.0.0.1:5190'
const mobile = process.env.PICKER_MOBILE_ORIGIN || 'http://127.0.0.1:8082'
const artifacts = 'test-results/date-pickers'
const snapshot = JSON.parse(await readFile(new URL('../../app/calendar/holidays.json', import.meta.url), 'utf8'))
const space = { id: '11111111-1111-4111-8111-111111111111', name: '우리의 공간', type: 'shared', my_role: 'owner', member_count: 2, is_default: true }
const browser = await chromium.launch({ headless: true, executablePath: process.env.PICKER_UI_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
await mkdir(artifacts, { recursive: true })

async function setup(origin, native, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, timezoneId: 'Asia/Seoul' })
  if (native) await context.addInitScript(() => {
    let define
    Object.defineProperty(window, '__d', { configurable: true, get: () => define, set: original => {
      define = (factory, id, dependencies, name, ...rest) => {
        if (name?.includes('ExpoSecureStore.web')) factory = (_g, _r, _d, _a, module) => {
          module.exports = { __esModule: true, default: { getValueWithKeyAsync: async () => 'test-token', setValueWithKeyAsync: async () => {}, deleteValueWithKeyAsync: async () => {} } }
        }
        return original(factory, id, dependencies, name, ...rest)
      }
    } })
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.clock.install({ time: new Date('2026-10-13T03:00:00Z') })
  await context.route('**/api/v1/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v1', '')
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,OPTIONS' }
    const status = request.method() === 'OPTIONS' ? 204 : 200
    let data = { items: [], next_cursor: null }
    if (path === '/auth/me') data = { id: 1, nickname: '검증 사용자', email: 'ui@example.com', default_space_id: space.id, theme_key: 'rose' }
    else if (path === '/spaces') data = { spaces: [space] }
    else if (path === '/spaces/' + space.id) data = space
    else if (path === '/menus') data = { menus: ['home', 'calendar', 'schedules', 'records', 'more'].map(code => ({ code, name: code, icon: code, children: [] })) }
    else if (path === '/calendar/holidays') {
      const year = Number(url.searchParams.get('year'))
      const rows = snapshot.years[year]
      const days = (rows || []).map(row => ({ date: `${year}-${row[0]}`, names: row[1], kind: row[2] || 'public' }))
      data = { year, coverage: rows ? 'complete' : 'unavailable', days, months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: rows ? days.filter(day => Number(day.date.slice(5, 7)) === i + 1).length : null, status: rows ? 'ready' : 'unavailable' })) }
    }
    await route.fulfill({ status, headers, ...(status === 204 ? {} : { contentType: 'application/json', body: JSON.stringify(data) }) })
  })
  return { page, context, errors }
}

async function bounds(page, locator) {
  const box = await locator.boundingBox()
  const size = page.viewportSize()
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width + 1 && box.y + box.height <= size.height + 1, JSON.stringify(box))
  return box
}

try {
  // ── 웹: 하루 만들기 → 기간 시트(B) ──
  const { page, context, errors } = await setup(web, false)
  await page.goto(web + '/schedules/new')
  const start = page.getByRole('button', { name: '시작일', exact: true })
  const end = page.getByRole('button', { name: '종료일', exact: true })
  await start.click()
  const range = page.getByRole('dialog', { name: '기간 고르기', exact: true })
  await expect(range).toBeVisible()
  await expect(range.getByText('10월 13일 (화) · 당일')).toBeVisible()
  await expect(range.locator('[data-date="2026-10-03"]').getByText('개천절')).toBeVisible()
  await range.locator('[data-date="2026-10-03"]').click()
  await expect(range.getByText('끝나는 날을 누르거나, 하루만이면 바로 적용하세요')).toBeVisible()
  await range.locator('[data-date="2026-10-05"]').click()
  await expect(range.getByText('10월 3일 (토) – 10월 5일 (월) · 2박 3일')).toBeVisible()
  await page.screenshot({ path: artifacts + '/web-range.png' })
  await range.getByRole('button', { name: /적용하기$/ }).click()
  await expect(start).toContainText('2026.10.03')
  await expect(end).toContainText('2026.10.05')
  await expect(start).toBeFocused()
  // 종료일 칸을 눌러도 같은 기간 시트가 지금 기간으로 열린다. 방향키로 하루씩 옮기고 Esc로 닫는다.
  await end.click()
  await expect(range.getByText('10월 3일 (토) – 10월 5일 (월) · 2박 3일')).toBeVisible()
  await range.locator('[data-date="2026-10-03"]').focus()
  await page.keyboard.press('ArrowRight')
  await expect(range.locator('[data-date="2026-10-04"]')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(range).toHaveCount(0)
  await expect(end).toBeFocused()
  await expect(end).toContainText('2026.10.05')

  // ── 웹: 캘린더 월 이동 → 하루 시트(A)의 달 고르기 ──
  await page.goto(web + '/calendar')
  await page.getByRole('button', { name: '월 이동', exact: true }).click()
  const month = page.getByRole('dialog', { name: '월 이동 고르기', exact: true })
  await expect(month.getByRole('button', { name: '2026년 5월, 공휴일 4일', exact: true })).toBeVisible()
  await page.screenshot({ path: artifacts + '/web-month.png' })
  await month.getByRole('button', { name: '2026년, 연도 고르기', exact: true }).click()
  await month.getByRole('button', { name: '2024년', exact: true }).click()
  await expect(month.getByText('이 연도의 공휴일 정보를 확인할 수 없어요. 날짜는 고를 수 있어요.')).toBeVisible()
  await month.getByRole('button', { name: /^2024년 3월/ }).click()
  await expect(month).toHaveCount(0)

  // ── 웹: 모아보기 시작일 → 하루 시트(A): 누르면 바로 정해지고, "날짜 없음"으로 비운다 ──
  await page.goto(web + '/more/collection')
  const from = page.getByRole('button', { name: '시작일', exact: true })
  await from.click()
  const day = page.getByRole('dialog', { name: '시작일 고르기', exact: true })
  await expect(day.getByText('날짜를 누르면 바로 정해져요')).toBeVisible()
  await page.screenshot({ path: artifacts + '/web-date.png' })
  await day.locator('[data-date="2026-10-03"]').click()
  await expect(day).toHaveCount(0)
  await expect(from).toContainText('2026.10.03')
  await from.click()
  await day.getByRole('button', { name: '날짜 없음', exact: true }).click()
  await expect(from).toContainText('날짜 선택')

  // 좁은 화면에서도 시트가 화면 안에 들어온다.
  await page.setViewportSize({ width: 390, height: 844 })
  await from.click()
  await page.waitForTimeout(350) // 시트가 올라오는 애니메이션(220ms)이 끝난 뒤에 잰다
  await bounds(page, day)
  await page.screenshot({ path: artifacts + '/web-date-narrow.png' })
  await page.keyboard.press('Escape')
  assert.deepEqual(errors, [])
  await context.close()
  console.log('Web: range sheet from either field, month grid holiday counts, unknown year notice, direct day pick, clear, keyboard and narrow layout passed.')

  // ── 앱: 모아보기 → 하루 시트(A) ──
  const native = await setup(mobile, true, 390)
  const app = native.page
  await app.goto(mobile + '/more/collection')
  await app.getByRole('button', { name: '시작일 선택', exact: true }).click({ timeout: 60000 })
  await expect(app.getByRole('button', { name: '2026년 10월 3일 토요일, 개천절', exact: true })).toBeVisible()
  await app.screenshot({ path: artifacts + '/app-date.png' })
  await app.getByRole('button', { name: '10월, 달 고르기', exact: true }).click()
  await expect(app.getByRole('button', { name: '2026년 5월', exact: true })).toBeVisible()
  await app.getByRole('button', { name: '2026년, 연도 고르기', exact: true }).click()
  await app.getByRole('button', { name: '2025년', exact: true }).click()
  await app.getByRole('button', { name: '2025년 5월', exact: true }).click()
  await app.getByRole('button', { name: '2025년 5월 5일 월요일, 어린이날, 부처님오신날', exact: true }).click()
  await expect(app.getByRole('button', { name: '시작일 2025-05-05', exact: true })).toBeVisible()
  // 둘러보다가 바깥을 눌러 닫으면 값은 그대로다.
  await app.getByRole('button', { name: '시작일 2025-05-05', exact: true }).click()
  await app.getByRole('button', { name: '다음 달', exact: true }).click()
  await app.getByRole('button', { name: '시작하는 날 고르기 닫기', exact: true }).click({ position: { x: 20, y: 20 } })
  await expect(app.getByRole('button', { name: '시작일 2025-05-05', exact: true })).toBeVisible()

  // ── 앱: 하루 만들기 → 기간 시트(B) ──
  await app.goto(mobile + '/schedules/new')
  await app.getByRole('button', { name: /^날짜, / }).click()
  await app.getByRole('button', { name: /^2026년 10월 20일 화요일/ }).click()
  await app.getByRole('button', { name: /^2026년 10월 22일 목요일/ }).click()
  await app.screenshot({ path: artifacts + '/app-range.png' })
  await app.getByRole('button', { name: /적용하기$/ }).click()
  await expect(app.getByRole('button', { name: /날짜, 10월 20일 .*22일 .*2박 3일/ })).toBeVisible()
  assert.deepEqual(native.errors, [])
  await native.context.close()
  console.log('App: day sheet with month/year drill-down, direct pick, outside close and schedule range sheet passed.')
} finally { await browser.close() }
