import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const origin = process.env.SCHEDULE_UI_ORIGIN ?? 'http://127.0.0.1:5182'
const browser = await chromium.launch({ headless: true, executablePath: process.env.SCHEDULE_UI_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' })
const page = await context.newPage()
const space = { id: '11111111-1111-4111-8111-111111111111', name: '우리의 공간', type: 'shared', my_role: 'owner', member_count: 2, is_default: true }
const initial = { id: 77, space_id: space.id, space_name: space.name, title: '가을 여행', description: '처음 메모', start_at: '2026-10-30T03:00:00Z', end_at: '2026-10-31T06:00:00Z', status: 'completed', completed_at: '2026-10-31T06:00:00Z', created_by: { id: 1, nickname: '나' }, place_count: 2, has_diary: true, experience_phase: 'recorded', record_summary: { has_content: true, has_diary_text: true, photo_count: 3, timeline_count: 1, cover_thumbnail_url: null, diary_excerpt: '여행의 기억' }, places: null }
let schedule = structuredClone(initial)
let timeline = [{ id: 1, occurred_at: '2026-10-31T01:00:00Z', title: '산책', created_by: { id: 1, nickname: '나' } }]
let failSave = false
let failDelete = false
let unavailable = false
let loseSaveResponse = false
let loseDeleteResponse = false
let patchCount = 0
let deleteCount = 0
let submitted
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/v1/**', async route => {
  const req = route.request()
  const path = new URL(req.url()).pathname.replace('/api/v1', '')
  const method = req.method()
  const headers = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,authorization', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' }
  let status = 200
  let data
  if (method === 'OPTIONS') status = 204
  else if (path === '/auth/me') data = { id: 1, nickname: '나', email: 'ui@example.com', default_space_id: space.id, theme_key: 'rose' }
  else if (path === '/spaces') data = { spaces: [space] }
  else if (path === '/spaces/' + space.id) data = space
  else if (path === '/menus') data = { menus: ['home', 'calendar', 'schedules', 'records', 'more'].map(code => ({ code, name: code, icon: null, children: [] })) }
  else if (path === '/schedules/77' && (unavailable || !schedule)) { status = 404; data = { code: 'SCHEDULE_NOT_FOUND', message: '일정을 찾을 수 없습니다.', field: null } }
  else if (path === '/schedules/77' && method === 'PATCH') {
    patchCount++
    submitted = req.postDataJSON()
    if (failSave) { status = 500; data = { code: 'TEST_FAILURE', message: '저장하지 못했어요. 다시 시도해 주세요.', field: null } }
    else {
      schedule = { ...schedule, ...submitted }
      if (loseSaveResponse) { loseSaveResponse = false; await route.abort('failed'); return }
      data = schedule
    }
  } else if (path === '/schedules/77' && method === 'DELETE') {
    deleteCount++
    await new Promise(resolve => setTimeout(resolve, 100))
    if (failDelete) { status = 500; data = { code: 'TEST_FAILURE', message: '지우지 못했어요.', field: null } }
    else {
      schedule = null
      if (loseDeleteResponse) { loseDeleteResponse = false; await route.abort('failed'); return }
      status = 204
    }
  } else if (path === '/schedules/77') data = schedule
  else if (path === '/schedules/77/places') data = { items: [] }
  else if (path === '/schedules/77/diary/timeline') data = { items: timeline }
  else if (path === '/schedules/77/diary/photos') data = { photos: [] }
  else if (path === '/schedules/77/diaries') data = { items: [] }
  else data = { items: [], next_cursor: null }
  await route.fulfill({ status, headers, ...(status === 204 ? {} : { contentType: 'application/json', body: JSON.stringify(data) }) })
})
async function openMenu() { await page.getByText('일정 관리', { exact: true }).click() }
async function shot(name) {
  await mkdir('test-results/schedule-management', { recursive: true })
  await page.screenshot({ path: 'test-results/schedule-management/' + name + '.png', fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal overflow: ' + name)
}
try {
  await page.goto(origin + '/schedules/77')
  await openMenu()
  await page.getByRole('button', { name: '일정 고치기', exact: true }).click()
  await expect(page.getByLabel('하루의 이름', { exact: false })).toHaveValue(initial.title)
  await expect(page.getByLabel('시작일', { exact: false })).toHaveValue('2026-10-30')
  await expect(page.getByLabel('시작 시간', { exact: false })).toHaveValue('12:00')
  await expect(page.getByText('1박 2일', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '저장하기', exact: true })).toBeDisabled()
  await shot('edit-390')

  await page.getByLabel('하루의 이름', { exact: false }).fill('   ')
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page.getByText('하루의 이름을 입력해 주세요.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '안내 닫기' }).click()
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page.getByText('하루의 이름을 입력해 주세요.', { exact: true })).toBeVisible()
  assert.equal(patchCount, 0)

  await page.getByLabel('하루의 이름', { exact: false }).fill('고친 여행')
  await page.getByRole('button', { name: '뒤로 가기', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: '계속 고치기', exact: true }).click()
  await expect(page.getByLabel('하루의 이름', { exact: false })).toHaveValue('고친 여행')
  await page.goBack()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: '계속 고치기', exact: true }).click()
  await expect(page).toHaveURL(/\/edit$/)

  await page.getByRole('button', { name: '뒤로 가기', exact: true }).click()
  await page.getByRole('button', { name: '저장하지 않고 나가기', exact: true }).click()
  await expect(page).toHaveURL(/\/schedules\/77$/)
  assert.equal(schedule.title, initial.title)
  await openMenu()
  await page.getByRole('button', { name: '일정 고치기', exact: true }).click()
  await page.getByLabel('하루의 이름', { exact: false }).fill('고친 여행')

  await page.getByLabel('종료일', { exact: false }).fill('2026-10-30')
  await page.getByLabel('종료 시간', { exact: false }).selectOption('12:00')
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page.getByText('종료 시간은 시작 시간보다 늦어야 해요.', { exact: true })).toBeVisible()
  await page.getByLabel('종료 시간', { exact: false }).selectOption('15:00')
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page.getByText('범위 밖에 남긴 기록이 있어요. 타임라인 날짜를 고치거나 일정 기간을 다시 선택해 주세요.', { exact: true })).toBeVisible()
  assert.equal(patchCount, 0)

  await page.getByLabel('종료일', { exact: false }).fill('2026-11-01')
  await page.getByLabel('종료 시간', { exact: false }).selectOption('09:00')
  await page.getByLabel('메모', { exact: true }).fill('')
  failSave = true
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page.getByText('저장하지 못했어요. 다시 시도해 주세요.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('하루의 이름', { exact: false })).toHaveValue('고친 여행')
  failSave = false
  loseSaveResponse = true
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page).toHaveURL(/\/schedules\/77$/)
  await expect(page.getByText('일정을 고쳤어요.', { exact: true })).toBeVisible()
  assert.equal(submitted.description, null)
  assert.equal(submitted.end_at, '2026-11-01T00:00:00.000Z')
  assert.ok(!('status' in submitted) && !('space_id' in submitted) && !('created_by' in submitted))
  assert.equal(schedule.status, initial.status)
  assert.equal(schedule.completed_at, initial.completed_at)
  assert.equal(timeline.length, 1)

  await openMenu()
  await page.getByRole('button', { name: '일정 지우기', exact: true }).click()
  await expect(page.getByText('함께 남긴 다른 사람의 기록도 지워지고, 모든 멤버의 화면에서 사라져요.', { exact: true })).toBeVisible()
  await expect(page.getByText('사진 3장', { exact: true })).toBeVisible()
  await shot('delete-390')
  await page.getByRole('button', { name: '돌아가기', exact: true }).click()
  assert.equal(deleteCount, 0)
  await openMenu()
  await page.getByRole('button', { name: '일정 지우기', exact: true }).click()
  failDelete = true
  await page.getByRole('button', { name: '일정 지우기', exact: true }).click()
  await expect(page.getByText('지우지 못했어요. 연결을 확인하고 다시 시도해 주세요.', { exact: true })).toBeVisible()
  assert.ok(schedule)
  failDelete = false
  await page.getByRole('button', { name: '일정 지우기', exact: true }).evaluate(button => { button.click(); button.click() })
  await expect(page).toHaveURL(/\/schedules$/)
  await expect(page.getByText('일정을 지웠어요.', { exact: true })).toBeVisible()
  assert.equal(deleteCount, 2)
  await page.goto(origin + '/schedules/77')
  await expect(page.getByText(/일정을 찾을 수 없거나 접근할 수 없어요/)).toBeVisible()

  schedule = structuredClone(initial)
  space.my_role = 'member'
  schedule.created_by.id = 2
  await page.goto(origin + '/schedules/77/delete')
  await expect(page.getByText('일정 작성자나 공간 소유자만 지울 수 있어요.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '일정 지우기', exact: true })).toHaveCount(0)
  await page.goto(origin + '/schedules/77')
  await openMenu()
  await expect(page.getByRole('button', { name: '일정 고치기', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '일정 지우기', exact: true })).toHaveCount(0)
  schedule.created_by.id = 1
  await page.goto(origin + '/schedules/77/delete')
  await expect(page.getByRole('button', { name: '일정 지우기', exact: true })).toBeVisible()

  space.my_role = 'owner'
  await page.goto(origin + '/schedules/77/edit')
  await page.setViewportSize({ width: 320, height: 844 })
  await shot('edit-320')
  await page.goto(origin + '/schedules/77/delete')
  await shot('delete-320')
  await page.setViewportSize({ width: 1280, height: 900 })
  await shot('delete-desktop')
  await page.goto(origin + '/schedules/77/edit')
  await shot('edit-desktop')

  await page.getByLabel('하루의 이름', { exact: false }).fill('내가 고친 이름')
  schedule.title = '다른 사람이 고친 이름'
  schedule.description = '새 메모'
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('다른 사람이 일정을 고쳤어요.')
  await page.getByRole('button', { name: '내 입력 유지', exact: true }).click()
  await expect(page.getByLabel('메모', { exact: true })).toHaveValue('새 메모')
  await page.getByRole('button', { name: '저장하기', exact: true }).click()
  await expect(page).toHaveURL(/\/schedules\/77$/)
  assert.deepEqual(submitted, { title: '내가 고친 이름' })

  await page.goto(origin + '/schedules/77/delete')
  loseDeleteResponse = true
  await page.getByRole('button', { name: '일정 지우기', exact: true }).click()
  await expect(page).toHaveURL(/\/schedules$/)
  await expect(page.getByText('일정을 찾을 수 없거나 접근할 수 없어요. 목록을 확인해 주세요.', { exact: true })).toBeVisible()
  await expect(page.getByText('일정을 지웠어요.', { exact: true })).toHaveCount(0)

  unavailable = true
  await page.goto(origin + '/schedules/77/edit')
  await expect(page.getByText('일정을 찾을 수 없거나 접근할 수 없어요.', { exact: true })).toBeVisible()
  assert.deepEqual(errors, [])
  console.log('PASS: edit/delete navigation, KST prefilling in overseas timezone, validation/snackbar repetition, dirty back protection, timeline range, null memo, failed/lost writes, completed-state preservation, cache removal, permissions, concurrent fields, 320px/desktop layout')
} finally { await context.close(); await browser.close() }
