// 크리스마스 배경 A "눈 오는 골목"을 웹 화면으로 확인한다. API는 가짜로 바꿔 끼운다.
// 실행: 개발 서버를 띄운 뒤(npx vite --port 5190 --strictPort) node scripts/test-seasonal-ui.mjs
//
// 확인하는 것
// 1. 낮(12-14 12시)·밤(12-14 21시)에 다섯 탭이 장면을 입고, 밤에는 카드 밖 제목이 흰색이 된다
// 2. 칩 ×로 끄면 PATCH {seasonal_background_enabled:false}가 나가고 "되돌리기"로 다시 켜진다
// 3. 더보기 "사용자 설정"에서 밤을 고르면 저장된다
// 4. 하위 화면(테마)과 기간 밖(12-27)에는 장면이 없다
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const origin = process.env.SEASONAL_UI_ORIGIN ?? 'http://127.0.0.1:5190'
const artifacts = path.resolve(process.env.SEASONAL_UI_ARTIFACTS ?? 'test-results/seasonal')
const space = { id: '11111111-1111-4111-8111-111111111111', name: '우리의 공간', type: 'shared', my_role: 'owner', member_count: 2, is_default: true }
const summary = { has_content: false, has_diary_text: false, photo_count: 0, timeline_count: 0, cover_thumbnail_url: null, diary_excerpt: null }
const schedule = (id, day, title) => ({
  id, space_id: space.id, space_name: space.name, title, description: null,
  start_at: `2026-12-${day}T09:00:00Z`, end_at: `2026-12-${day}T13:00:00Z`, status: 'planned',
  created_by: { id: 1, nickname: '하루' }, place_count: 0, has_diary: false, completed_at: null,
  experience_phase: 'upcoming', record_summary: summary, places: [],
})
const schedules = [schedule(201, '24', '크리스마스이브 저녁'), schedule(202, '25', '성수 카페 투어')]
const feed = [{
  schedule_id: 101, title: '첫눈 오던 날', start_at: '2026-12-05T05:00:00Z', end_at: '2026-12-05T10:00:00Z', sorted_at: '2026-12-05T10:00:00Z',
  completed_at: '2026-12-05T10:00:00Z', experience_phase: 'completed', place_count: 2, authors: [{ id: 1, nickname: '하루' }],
  record_summary: { ...summary, has_content: true, has_diary_text: true, diary_excerpt: '눈이 와서 계획보다 천천히 걸었다.' },
}]

const baseUser = () => ({
  id: 1, nickname: '하루', email: 'ui@example.com', default_space_id: space.id, theme_key: 'rose',
  seasonal_background_enabled: true, seasonal_background_time: 'auto', created_at: '2026-08-01T00:00:00Z',
})

async function openPage(browser, time, user, patches) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul' })
  const page = await context.newPage()
  await page.clock.install({ time: new Date(time) })
  await page.route('**/api/v1/**', async route => {
    const req = route.request()
    const routePath = new URL(req.url()).pathname.replace('/api/v1', '')
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' }
    let status = 200
    let data = { items: [], next_cursor: null }
    if (req.method() === 'OPTIONS') status = 204
    else if (routePath === '/users/me' && req.method() === 'PATCH') {
      const body = req.postDataJSON()
      patches.push(body)
      Object.assign(user, body)
      data = user
    } else if (routePath === '/auth/me') data = user
    else if (routePath === '/spaces') data = { spaces: [space] }
    else if (routePath === `/spaces/${space.id}`) data = space
    else if (routePath === '/menus') data = { menus: ['home', 'calendar', 'schedules', 'records', 'more'].map((code, i) => ({ code, name: ['홈', '캘린더', '일정', '기록', '더보기'][i], icon: code, children: [] })) }
    else if (/\/spaces\/[^/]+\/schedules$/.test(routePath)) data = { items: schedules }
    else if (/\/spaces\/[^/]+\/diaries$/.test(routePath)) data = { items: feed, next_cursor: null }
    await route.fulfill({ status, headers, ...(status === 204 ? {} : { contentType: 'application/json', body: JSON.stringify(data) }) })
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  return { context, page, errors }
}

async function shoot(page, name) {
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) })
}

async function titleColor(page, selector) {
  return page.locator(selector).first().evaluate(el => getComputedStyle(el).color)
}

await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.SEASONAL_UI_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
try {
  for (const [label, time] of [['day', '2026-12-14T03:00:00Z'], ['night', '2026-12-14T12:00:00Z']]) {
    const user = baseUser()
    const patches = []
    const { context, page, errors } = await openPage(browser, time, user, patches)
    const white = label === 'night'

    for (const [tab, heading, check] of [
      ['/schedules', '.slist-page__heading', '크리스마스이브 저녁'],
      ['/records', '.records-page__title', '첫눈 오던 날'],
      ['/calendar', '.calendar-header__title', null],
      ['/home', '.home-page__title', null],
      ['/more', '.more-page__heading', '12월 26일까지만 보여요'],
    ]) {
      await page.goto(origin + tab)
      await expect(page.getByText('하루님, 메리 크리스마스')).toBeVisible({ timeout: 30000 })
      await expect(page.getByText('크리스마스까지 D-11')).toBeVisible()
      if (check) await expect(page.getByText(check)).toBeVisible()
      await expect(page.locator('.season-scene')).toHaveCount(1)
      // 캘린더 제목은 카드 안이라 밤에도 원래 색이다.
      if (tab !== '/calendar') {
        const color = await titleColor(page, heading)
        assert.equal(color === 'rgb(255, 255, 255)', white, `${label} ${tab} 제목 색 ${color}`)
      }
      await shoot(page, `${label}${tab.replace('/', '-')}`)
    }

    // 더보기 아래쪽(설정 줄과 계정 줄)
    await page.goto(origin + '/more')
    await page.getByText('사용자 설정', { exact: true }).scrollIntoViewIfNeeded()
    await shoot(page, `${label}-more-settings`)

    if (label === 'day') {
      await page.getByRole('radio', { name: '밤' }).click()
      await expect.poll(() => patches.at(-1)).toEqual({ seasonal_background_time: 'night' })
      await expect(page.locator('.app-layout--season-night')).toHaveCount(1)
      await expect(page.getByText('시간과 상관없이 늘 밤으로 보여요')).toBeVisible()
      await page.getByRole('radio', { name: '자동' }).click()
      await expect.poll(() => patches.at(-1)).toEqual({ seasonal_background_time: 'auto' })

      await page.goto(origin + '/schedules')
      await page.getByRole('button', { name: '크리스마스 배경 끄기' }).click()
      await expect.poll(() => patches.at(-1)).toEqual({ seasonal_background_enabled: false })
      await expect(page.locator('.season-scene')).toHaveCount(0)
      await expect(page.getByText('크리스마스 배경을 껐어요. 더보기에서 다시 켤 수 있어요.')).toBeVisible()
      await shoot(page, 'day-schedules-off')
      await page.getByRole('button', { name: '되돌리기' }).click()
      await expect.poll(() => patches.at(-1)).toEqual({ seasonal_background_enabled: true })
      await expect(page.locator('.season-scene')).toHaveCount(1)

      // 하위 화면은 입지 않는다.
      await page.goto(origin + '/more/theme')
      await expect(page.getByText('로즈').first()).toBeVisible({ timeout: 30000 })
      await expect(page.locator('.season-scene')).toHaveCount(0)
    }

    assert.deepEqual(errors, [])
    await context.close()
    console.log(`${label}: five tabs wear the scene.`)
  }

  const { context, page } = await openPage(browser, '2026-12-27T03:00:00Z', baseUser(), [])
  await page.goto(origin + '/more')
  await expect(page.getByText('테마', { exact: true })).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.season-scene')).toHaveCount(0)
  await expect(page.getByText('크리스마스 배경')).toHaveCount(0)
  await context.close()
  console.log('after season: no scene, no settings rows.')
  console.log(`screenshots: ${artifacts}`)
} finally {
  await browser.close()
}
