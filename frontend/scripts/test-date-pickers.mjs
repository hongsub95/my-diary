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
  const { page, context, errors } = await setup(web, false)
  await page.goto(web + '/schedules/new')
  const start = page.getByRole('button', { name: '시작일', exact: true })
  await start.click()
  const dialog = page.getByRole('dialog', { name: '날짜 선택', exact: true })
  await expect(dialog).toBeVisible()
  const calendar = dialog.getByRole('region', { name: '날짜별 달력' })
  const holidays = dialog.getByRole('region', { name: '2026년 10월 공휴일 목록' })
  await expect(holidays.getByText('개천절', { exact: true })).toBeVisible()
  assert.ok((await holidays.boundingBox()).x > (await calendar.boundingBox()).x, 'Separate desktop columns')
  await holidays.getByRole('button', { name: /개천절/ }).first().click()
  await expect(dialog.locator('[data-date="2026-10-03"]')).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: '취소', exact: true }).click()
  await expect(start).toContainText('2026.10.13')
  await start.click()
  await dialog.locator('[data-date="2026-10-03"]').click()
  await dialog.getByRole('button', { name: '적용', exact: true }).click()
  await expect(start).toContainText('2026.10.03')
  await start.click()
  await page.screenshot({ path: artifacts + '/web-date-desktop.png' })
  await dialog.getByRole('button', { name: '10월, 월 선택', exact: true }).click()
  await expect(dialog.getByRole('button', { name: '5월 공휴일 4일', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '11월 공휴일 0일', exact: true })).toBeVisible()
  await page.screenshot({ path: artifacts + '/web-month.png' })
  await dialog.getByRole('button', { name: '2026년, 연도 선택', exact: true }).click()
  await expect(dialog.getByText(/공휴일/)).toHaveCount(0)
  await page.screenshot({ path: artifacts + '/web-year.png' })
  await dialog.getByRole('button', { name: '2024년', exact: true }).click()
  await expect(dialog.getByRole('button', { name: '5월 정보 없음', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(start).toBeFocused()
  await start.click()
  await dialog.locator('[data-date="2026-10-03"]').focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.locator('[data-date="2026-10-04"]')).toBeFocused()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await start.click()
  await bounds(page, dialog)
  assert.ok((await holidays.boundingBox()).y > (await calendar.boundingBox()).y, 'Narrow web stacks holiday region')
  await page.screenshot({ path: artifacts + '/web-date-narrow.png' })
  await page.keyboard.press('Escape')
  await page.goto(web + '/more/collection')
  await page.getByRole('button', { name: '시작일', exact: true }).click()
  await page.getByRole('button', { name: '해제', exact: true }).click()
  await expect(page.getByRole('button', { name: '시작일', exact: true })).toContainText('날짜 선택')
  assert.deepEqual(errors, [])
  await context.close()
  console.log('Web: separate holidays, unique date counts, year-only grid, draft cancel/apply, unknown year, keyboard and narrow layout passed.')

  const native = await setup(mobile, true, 390)
  const app = native.page
  await app.goto(mobile + '/more/collection')
  await app.getByRole('button', { name: '시작일 선택', exact: true }).click({ timeout: 60000 })
  await expect(app.getByRole('button', { name: '2026년 10월 3일, 개천절', exact: true })).toBeVisible()
  const popup = app.getByRole('button', { name: '이전 달', exact: true }).locator('..').locator('..').locator('..').locator('..')
  await app.screenshot({ path: artifacts + '/app-date.png' })
  const popupBox = await bounds(app, popup)
  assert.ok(popupBox.width < 360 && popupBox.height < 500, 'Compact calendar overlay')
  await expect(app.getByText(/PUBLIC HOLIDAYS|공휴일 목록|공휴일 \d+일/)).toHaveCount(0)
  await app.getByRole('button', { name: '10월, 월 선택', exact: true }).click()
  await expect(app.getByRole('button', { name: '2026년 5월', exact: true })).toBeVisible()
  await app.screenshot({ path: artifacts + '/app-month.png' })
  await app.getByRole('button', { name: '2026년, 연도 선택', exact: true }).click()
  await app.screenshot({ path: artifacts + '/app-year.png' })
  await app.getByRole('button', { name: '2025년', exact: true }).click()
  await app.getByRole('button', { name: '2025년 5월', exact: true }).click()
  await app.getByRole('button', { name: '2025년 5월 5일, 어린이날, 부처님오신날', exact: true }).click()
  await expect(app.getByRole('button', { name: '시작일 2025-05-05', exact: true })).toBeVisible()
  await app.getByRole('button', { name: '시작일 2025-05-05', exact: true }).click()
  await app.getByRole('button', { name: '다음 달', exact: true }).click()
  await app.mouse.click(8, 8)
  await expect(app.getByRole('button', { name: '시작일 2025-05-05', exact: true })).toBeVisible()
  await app.goto(mobile + '/schedules/new')
  await app.getByRole('button', { name: /^날짜, / }).click()
  await app.getByRole('button', { name: '2026년 10월 20일', exact: true }).click()
  await app.getByRole('button', { name: '2026년 10월 22일', exact: true }).click()
  await app.screenshot({ path: artifacts + '/app-range.png' })
  await app.getByRole('button', { name: '선택한 기간 저장', exact: true }).click()
  await expect(app.getByRole('button', { name: /날짜, 10월 20일 .*22일 .*2박 3일/ })).toBeVisible()
  assert.deepEqual(native.errors, [])
  await native.context.close()
  console.log('App: anchored compact calendar, year/month drill-down, direct date apply, outside cancellation and schedule range passed.')
} finally { await browser.close() }
