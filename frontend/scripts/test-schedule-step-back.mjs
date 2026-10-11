import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

const origin = process.env.SCHEDULE_UI_ORIGIN ?? 'http://127.0.0.1:5178'
const browser = await chromium.launch({ headless: true, executablePath: process.env.SCHEDULE_UI_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
const space = { id: '11111111-1111-4111-8111-111111111111', name: '나만의 공간', type: 'personal', my_role: 'owner', is_default: true }
let schedule = { id: 77, space_id: space.id, title: '하루 테스트', description: '유지할 메모', start_at: '2026-10-30T03:00:00Z', end_at: '2026-10-31T06:00:00Z', status: 'planned', experience_phase: 'upcoming', record_summary: {}, places: null }
const places = [{ id: 3, sort_order: 0, place: { id: 8, name: '담아둔 카페', address: '서울', latitude: null, longitude: null }, planned_time: null, memo: '장소 메모', visited: false }]
let posts = 0
let patches = 0
let createdSpaceId = null
let failSave = false
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/v1/**', async route => {
  const req = route.request()
  const path = new URL(req.url()).pathname.replace('/api/v1', '')
  let status = 200
  let data = { items: [], menus: [] }
  if (req.method() === 'OPTIONS') status = 204
  else if (path === '/auth/me') data = { id: 1, nickname: '테스트', email: 'ui@example.com', default_space_id: space.id }
  else if (path === '/spaces') data = { spaces: [space] }
  else if (req.method() === 'POST' && path.endsWith('/schedules')) { posts++; createdSpaceId = path.split('/')[2]; data = schedule }
  else if (path === '/schedules/77' && req.method() === 'PATCH') {
    patches++
    if (failSave) { status = 500; data = { code: 'TEST_FAILURE', message: '다시 시도해 주세요.' } }
    else { schedule = { ...schedule, ...req.postDataJSON() }; data = schedule }
  } else if (path === '/schedules/77') data = schedule
  else if (path === '/schedules/77/places') data = { items: places }
  await route.fulfill({ status, headers: { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS' }, ...(status === 204 ? {} : { json: data }) })
})
try {
  await page.goto(origin + '/schedules/77/plan')
  await expect(page.getByText('담아둔 카페', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '1단계로 돌아가기', exact: true }).click()
  await expect(page.getByLabel('하루의 이름')).toHaveValue('하루 테스트')
  await expect(page.getByLabel('시작일')).toHaveValue('2026-10-30')
  await expect(page.getByLabel('시작 시간')).toHaveValue('12:00')
  await expect(page.getByLabel('종료일')).toHaveValue('2026-10-31')
  await expect(page.getByLabel('하루의 밑그림')).toHaveValue('유지할 메모')
  await expect(page.getByText('저장할 공간', { exact: true })).toHaveCount(0)
  await page.getByLabel('하루의 이름').fill('수정한 하루')
  failSave = true
  await page.getByRole('button', { name: '갈 곳 정하기 →', exact: true }).click()
  await expect(page.getByText('다시 시도해 주세요.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('하루의 이름')).toHaveValue('수정한 하루')
  await expect(page.getByRole('button', { name: '뒤로 가기', exact: true })).toBeEnabled()
  await page.locator('.snackbar button').click()
  failSave = false
  await page.getByRole('button', { name: '갈 곳 정하기 →', exact: true }).click()
  await expect(page).toHaveURL(origin + '/schedules/77/plan')
  await expect(page.getByRole('heading', { name: '수정한 하루', exact: true })).toBeVisible()
  await expect(page.getByText('담아둔 카페', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '1단계로 돌아가기', exact: true }).click()
  await expect(page.getByLabel('하루의 이름')).toHaveValue('수정한 하루')
  await page.reload()
  await expect(page.getByLabel('하루의 이름')).toHaveValue('수정한 하루')
  assert.equal(posts, 0)
  assert.equal(patches, 2)
  await page.goto(origin + '/schedules/new')
  await expect(page.getByText('저장할 공간', { exact: true })).toHaveCount(0)
  await page.getByLabel('하루의 이름').fill('현재 공간의 새 하루')
  await page.getByRole('button', { name: '갈 곳 정하기 →', exact: true }).click()
  await expect(page).toHaveURL(origin + '/schedules/77/plan')
  assert.equal(posts, 1)
  assert.equal(createdSpaceId, space.id)
  assert.deepEqual(errors, [])
  console.log('PASS: step back restores Korean dates and inputs, updates the same day, preserves places, retries failed saves, and survives reload without duplicate creation')
} finally { await browser.close() }
