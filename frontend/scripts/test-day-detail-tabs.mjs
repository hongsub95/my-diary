import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const mobile = process.env.DAY_DETAIL_PLATFORM === 'mobile'
const origin = process.env.DAY_DETAIL_ORIGIN ?? (mobile ? 'http://localhost:8081' : 'http://127.0.0.1:5182')
const browser = await chromium.launch({ headless: true, executablePath: process.env.DAY_DETAIL_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const space = { id: '11111111-1111-4111-8111-111111111111', name: '우리의 주말', type: 'shared', my_role: 'owner', member_count: 2, is_default: true }
let phase = 'upcoming'
let hasContent = false
let failSave = true
let writes = 0
const errors = []
if (mobile) await context.addInitScript(() => {
  let define
  Object.defineProperty(window, '__d', {
    configurable: true, get: () => define,
    set: original => {
      define = (factory, id, dependencies, name, ...rest) => {
        if (name?.includes('ExpoSecureStore.web')) {
          factory = (_global, _require, _default, _all, module) => {
            module.exports = { __esModule: true, default: {
              getValueWithKeyAsync: async () => 'test-access', setValueWithKeyAsync: async () => {}, deleteValueWithKeyAsync: async () => {},
            } }
          }
        }
        return original(factory, id, dependencies, name, ...rest)
      }
    },
  })
})
await context.route('**/api/v1/**', async route => {
  const request = route.request()
  const path = new URL(request.url()).pathname.replace(/^.*\/api\/v1/, '')
  const headers = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
  let status = 200
  let data = { items: [] }
  if (!['GET', 'HEAD'].includes(request.method())) {
    writes++
    if (failSave) return route.fulfill({ status: 500, headers, json: { code: 'TEST_FAILURE', message: '저장하지 못했어요. 다시 시도해 주세요.' } })
  }
  if (path === '/auth/me') data = { id: 1, nickname: '나', email: 'tabs@example.com', default_space_id: space.id, theme_key: 'rose' }
  else if (path === '/spaces') data = { spaces: [space] }
  else if (path === '/spaces/' + space.id) data = space
  else if (path === '/menus') data = { menus: ['home', 'calendar', 'schedules', 'records', 'more'].map(code => ({ code, name: code, icon: null, children: [] })) }
  else if (path === '/schedules/77') data = {
    id: 77, space_id: space.id, space_name: space.name, title: '느리게 걸었던 성수의 토요일', description: '창가에서 천천히 쉬기',
    start_at: '2026-10-10T03:00:00Z', end_at: '2026-10-10T09:00:00Z', created_by: { id: 1, nickname: '나' },
    status: phase === 'recorded' ? 'completed' : 'planned', experience_phase: phase, completed_at: null, place_count: 0, has_diary: hasContent, places: [],
    record_summary: { has_content: hasContent, has_diary_text: hasContent, photo_count: 0, timeline_count: 0, cover_thumbnail_url: null, diary_excerpt: null },
  }
  else if (path.endsWith('/photos')) data = { photos: [] }
  else if (path.endsWith('/diary') && request.method() !== 'GET') {
    data = { id: 1, author: { id: 1, nickname: '나' }, ...request.postDataJSON() }
    hasContent = true
  }
  await route.fulfill({ status, headers, json: data })
})
const page = await context.newPage()
page.on('pageerror', error => errors.push(error.message))
const plan = () => page.getByRole('tab', { name: '장소·계획', exact: true })
const record = () => page.getByRole('tab', { name: '사진·기록', exact: true })
async function selected(tab) { await expect(tab).toHaveAttribute('aria-selected', 'true') }
async function shot(name) {
  await mkdir('test-results/day-detail-tabs', { recursive: true })
  await page.screenshot({ path: `test-results/day-detail-tabs/${mobile ? 'mobile' : 'web'}-${name}.png`, fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal overflow')
}
try {
  await page.goto(origin + '/schedules/77')
  await selected(plan())
  await page.getByLabel('일정 관리', { exact: true }).click()
  const editOption = page.getByRole('button', { name: '수정', exact: true })
  const deleteOption = page.getByRole('button', { name: '삭제', exact: true })
  await expect(editOption).toBeVisible()
  await expect(deleteOption).toBeVisible()
  assert.ok((await deleteOption.boundingBox()).y > (await editOption.boundingBox()).y, 'Menu options are stacked')
  await shot('dropdown-390')
  if (mobile) await page.getByRole('button', { name: '일정 관리 메뉴 닫기', exact: true }).click({ position: { x: 5, y: 300 } })
  else { await editOption.focus(); await page.keyboard.press('Escape') }
  await expect(editOption).toBeHidden()
  await expect(page.getByText('아직 담은 장소가 없어요.', { exact: true })).toBeVisible()
  await shot('plan-390')
  await record().click()
  await selected(record())
  await (mobile ? page.getByText('오늘을 남기기', { exact: true }) : page.getByRole('button', { name: '오늘을 남기기', exact: true })).click()
  const content = page.getByPlaceholder('오늘 하루는 어땠나요?')
  await content.fill('탭을 바꿔도 남아야 하는 초안')
  await page.getByPlaceholder('오늘의 기분 (선택)').fill('편안함')
  await plan().click()
  await expect(content).toBeHidden()
  await record().click()
  await expect(content).toHaveValue('탭을 바꿔도 남아야 하는 초안')
  await expect(page.getByPlaceholder('오늘의 기분 (선택)')).toHaveValue('편안함')
  assert.equal(writes, 0, 'Switching tabs must not save')
  await (mobile ? page.getByText('저장', { exact: true }) : page.getByRole('button', { name: '저장', exact: true })).click()
  const saveError = mobile ? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.' : '저장하지 못했어요. 다시 시도해 주세요.'
  await expect(page.getByText(saveError, { exact: true })).toBeVisible()
  await expect(content).toHaveValue('탭을 바꿔도 남아야 하는 초안')
  await shot('record-draft-390')
  if (!mobile) {
    await record().focus()
    await page.keyboard.press('Home')
    await selected(plan())
    await page.keyboard.press('ArrowRight')
    await selected(record())
  }
  for (const state of [{ phase: 'today', hasContent: false, tab: 'plan' }, { phase: 'record_pending', hasContent: false, tab: 'plan' }, { phase: 'recorded', hasContent: true, tab: 'record' }, { phase: 'canceled', hasContent: false, tab: 'plan' }]) {
    phase = state.phase
    hasContent = state.hasContent
    await page.reload()
    await selected(state.tab === 'plan' ? plan() : record())
  }
  phase = 'recorded'; hasContent = true
  await page.reload()
  await selected(record())
  await page.setViewportSize({ width: 320, height: 844 })
  await shot('record-320')
  if (!mobile) { await page.setViewportSize({ width: 1200, height: 900 }); await shot('record-1200') }
  assert.deepEqual(errors, [])
  console.log(`${mobile ? 'Mobile' : 'Web'} detail tabs passed: default phases, switching, draft preservation, failed save, no implicit writes, responsive layout${mobile ? '' : ', keyboard navigation'}.`)
} finally { await browser.close() }
