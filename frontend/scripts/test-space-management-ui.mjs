import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

// Mock transport only: this test never creates or deletes real users or spaces.
const browser = await chromium.launch({ headless: true, executablePath: process.env.SPACE_UI_BROWSER ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
const personal = { id: '11111111-1111-4111-8111-111111111111', name: '나만의 공간', type: 'personal', my_role: 'owner', member_count: 1, is_default: true, join_code: null }
const shared = { ...personal, id: '22222222-2222-4222-8222-222222222222', name: '검증 공유 공간', type: 'shared', is_default: false, member_count: 2, join_code: 'K7M2QX9P' }
let spaces = [personal, shared]
let failRename = false
let failDelete = false
let renameCount = 0
let deleteCount = 0
let created = null
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/api/v1/**', async route => {
  const request = route.request()
  const path = new URL(request.url()).pathname.replace('/api/v1', '')
  const method = request.method()
  const headers = { 'access-control-allow-origin': 'http://127.0.0.1:5178', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS' }
  let status = 200
  let data
  if (method === 'OPTIONS') status = 204
  else if (path === '/auth/me') data = { id: 1, nickname: '검증 사용자', email: 'ui@example.com', default_space_id: personal.id, theme_key: 'rose' }
  else if (path === '/spaces') data = { spaces }
  else if (path.endsWith('/members')) data = { members: [{ user_id: 1, nickname: '주인', role: 'owner' }, { user_id: 2, nickname: '친구', role: 'member' }] }
  else if (path === '/spaces/' + shared.id && method === 'PATCH') {
    renameCount++
    if (failRename) { status = 500; data = { code: 'TEST_FAILURE', message: '다시 시도해 주세요.', field: null } }
    else { shared.name = request.postDataJSON().name; data = shared }
  } else if (path === '/spaces/' + shared.id && method === 'DELETE') {
    deleteCount++
    if (failDelete) { status = 500; data = { code: 'TEST_FAILURE', message: '다시 시도해 주세요.', field: null } }
    else { spaces = [personal]; status = 204 }
  } else if (path.startsWith('/spaces/') && path.endsWith('/schedules') && method === 'POST') {
    created = { ...request.postDataJSON(), id: 77, space_id: path.split('/')[2], status: 'planned', experience_phase: 'upcoming', place_count: 0, record_summary: { has_content: false, photo_count: 0, timeline_count: 0 } }
    status = 201; data = created
  } else if (path === '/schedules/77') data = created
  else if (path === '/schedules/77/places') data = { places: [] }
  else if (path.startsWith('/spaces/')) data = spaces.find(space => path === '/spaces/' + space.id)
  else data = { items: [], menus: [], next_cursor: null }
  await route.fulfill({ status, headers, ...(status === 204 ? {} : { contentType: 'application/json', body: JSON.stringify(data ?? {}) }) })
})
const origin = 'http://127.0.0.1:5178'
const shot = async name => { await mkdir('test-results/space-management', { recursive: true }); await page.screenshot({ path: 'test-results/space-management/' + name + '.png', fullPage: true }) }
try {
  await page.goto(origin + '/spaces')
  await expect(page.getByRole('heading', { name: '내 공간', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '＋ 새 공간 만들기', exact: true })).toBeVisible()
  await page.goto(origin + '/spaces/' + shared.id)
  await expect(page.getByRole('heading', { name: '공간 관리', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '공간 이름 수정', exact: true }).click()
  await page.getByLabel('공간 이름', { exact: true }).fill('   ')
  await page.getByRole('button', { name: '이름 저장', exact: true }).click()
  await expect(page.getByText('공간 이름을 1~30자로 입력해 주세요.', { exact: true })).toBeVisible()
  assert.equal(renameCount, 0)
  failRename = true
  await page.getByLabel('공간 이름', { exact: true }).fill('바꾼 공간')
  await page.getByRole('button', { name: '이름 저장', exact: true }).click()
  await expect(page.getByText('다시 시도해 주세요.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('공간 이름', { exact: true })).toHaveValue('바꾼 공간')
  failRename = false
  await page.getByRole('button', { name: '이름 저장', exact: true }).click()
  await expect(page.getByRole('heading', { name: '바꾼 공간', exact: true })).toBeVisible()
  await shot('renamed')

  await page.goto(origin + '/schedules/new')
  await page.getByLabel('하루의 이름', { exact: false }).fill('저장 대상 검증')
  await page.getByLabel('하루의 밑그림', { exact: true }).fill('공간을 바꿔도 남는 메모')
  const start = await page.getByLabel('시작일', { exact: false }).inputValue()
  await page.getByLabel('저장할 공간', { exact: true }).selectOption(shared.id)
  await expect(page.getByLabel('하루의 이름', { exact: false })).toHaveValue('저장 대상 검증')
  await expect(page.getByLabel('하루의 밑그림', { exact: true })).toHaveValue('공간을 바꿔도 남는 메모')
  await expect(page.getByLabel('시작일', { exact: false })).toHaveValue(start)
  await shot('schedule-space')
  await page.getByRole('button', { name: '갈 곳 정하기 →', exact: true }).click()
  await expect(page).toHaveURL(/\/schedules\/77\/plan$/)
  assert.equal(created.space_id, shared.id)
  assert.equal(personal.is_default, true)
  assert.equal(shared.is_default, false)

  await page.goto(origin + '/spaces/' + shared.id)
  await page.getByRole('button', { name: '공간 삭제', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('바꾼 공간')
  await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click()
  assert.equal(deleteCount, 0)
  await page.getByRole('button', { name: '공간 삭제', exact: true }).click()
  failDelete = true
  await page.getByRole('dialog').getByRole('button', { name: '공간 삭제', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('다시 시도해 주세요.', { exact: true })).toBeVisible()
  failDelete = false
  await shot('delete-confirmation')
  await page.getByRole('dialog').getByRole('button', { name: '공간 삭제', exact: true }).click()
  await expect(page).toHaveURL(/\/spaces$/)
  await expect(page.getByRole('heading', { name: '바꾼 공간', exact: true })).toHaveCount(0)
  await page.goto(origin + '/spaces/' + personal.id)
  await expect(page.getByRole('button', { name: '공간 삭제', exact: true })).toHaveCount(0)

  spaces = [personal, { ...shared, my_role: 'member' }]
  await page.goto(origin + '/spaces/' + shared.id)
  await expect(page.getByRole('button', { name: '공간 이름 수정', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '공간 삭제', exact: true })).toHaveCount(0)
  spaces = [personal, { ...shared, is_default: true }]
  await page.reload()
  await expect(page.getByRole('button', { name: '공간 삭제', exact: true })).toBeDisabled()
  await page.setViewportSize({ width: 320, height: 844 })
  await shot('default-space-320')
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '320px overflow')
  assert.deepEqual(errors, [])
  console.log('PASS: copy table, rename validation/failure/success, selected-space schedule save with draft/default preserved, delete cancel/failure/success, member/personal/default restrictions, 320px layout')
} finally {
  await context.close()
  await browser.close()
}

