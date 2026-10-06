import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

// This runner creates disposable users. Run only against the isolated test stack.
assert.equal(process.env.SPACE_E2E_ISOLATED, '1', 'Set SPACE_E2E_ISOLATED=1 for the disposable test server')
const api = process.env.SPACE_E2E_API_URL ?? 'http://127.0.0.1:8174/api/v1'
const ui = process.env.SPACE_E2E_UI_URL ?? 'http://host.docker.internal:5176'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(api).hostname), 'The API must be local')
const browser = await chromium.connect(process.env.SPACE_E2E_BROWSER_WS ?? 'ws://127.0.0.1:9335/')
const artifacts = new URL('../test-results/spaces/', import.meta.url)
await mkdir(artifacts, { recursive: true })
const errors = []
const contexts = []
const password = 'Password1234!'
const suffix = Date.now()

async function request(path, user, method = 'GET', body) {
  const response = await fetch(`${api}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.access_token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = response.status === 204 ? null : await response.json()
  return { status: response.status, data }
}
async function account(kind, nickname) {
  const email = `spaces-${kind}-${suffix}@example.com`
  const result = await request('/auth/register', null, 'POST', { email, nickname: `${nickname}${suffix}`, password, agreed_terms: true, agreed_privacy: true, is_over_14: true })
  assert.equal(result.status, 201, JSON.stringify(result.data))
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  contexts.push(context)
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${ui}/login`)
  await page.getByLabel('이메일', { exact: true }).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill(password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
  return { ...result.data.user, ...result.data.tokens, page }
}
async function go(user, path) { await user.page.goto(`${ui}${path}`) }
async function shot(user, name) { await user.page.screenshot({ path: fileURLToPath(new URL(name, artifacts)), fullPage: true }) }
async function confirm(user, opener, label) {
  await user.page.getByRole('button', { name: opener, exact: true }).click()
  const dialog = user.page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: label, exact: true }).click()
  await expect(dialog).toBeHidden()
}
try {
  const owner = await account('owner', '검증주인')
  const member = await account('member', '검증멤버')
  await go(owner, '/spaces')
  await expect(owner.page.getByText('나만의 공간', { exact: true })).toBeVisible()
  await shot(owner, 'list.png')
  await owner.page.getByRole('link', { name: /새 공간 만들기/ }).click()
  await owner.page.getByLabel('공간 이름', { exact: true }).fill('검증 우리 둘')
  await owner.page.getByRole('button', { name: '새 공간 만들기', exact: true }).click()
  await expect(owner.page.locator('.space-code')).toBeVisible()
  const spaceId = new URL(owner.page.url()).pathname.split('/').at(-1)
  const oldCode = await owner.page.locator('.space-code').innerText()
  console.log('PASS: 로그인 · 공간 생성 · 개인 공간 보존')

  await go(member, '/spaces/join')
  await member.page.getByRole('button', { name: '이 공간에 참여하기', exact: true }).click()
  await expect(member.page.getByText('8자리 영문·숫자 참여 번호를 확인해 주세요.', { exact: true })).toBeVisible()
  await member.page.getByLabel('참여 번호', { exact: true }).fill(`${oldCode.slice(0, 4)}-${oldCode.slice(4)}`.toLowerCase())
  await shot(member, 'join.png')
  await member.page.getByRole('button', { name: '이 공간에 참여하기', exact: true }).click()
  await expect(member.page).toHaveURL(new RegExp(`/spaces/${spaceId}$`))
  await expect(member.page.getByRole('heading', { name: '함께하는 사람 2명' })).toBeVisible()
  await expect(member.page.getByRole('button', { name: '새 번호 받기', exact: true })).toHaveCount(0)
  await expect(member.page.getByRole('button', { name: '주인 넘기기', exact: true })).toHaveCount(0)
  await go(member, '/spaces/join')
  await member.page.getByLabel('참여 번호', { exact: true }).fill(oldCode)
  await member.page.getByRole('button', { name: '이 공간에 참여하기', exact: true }).click()
  await expect(member.page).toHaveURL(new RegExp(`/spaces/${spaceId}$`))
  console.log('PASS: 입력 안내 · 번호 정규화 · 참여 · 중복 참여 · 멤버 권한')

  await owner.page.reload()
  await expect(owner.page.getByRole('heading', { name: '함께하는 사람 2명' })).toBeVisible()
  await expect(owner.page.getByRole('button', { name: '공간 나가기', exact: true })).toBeDisabled()
  await owner.page.setViewportSize({ width: 320, height: 740 })
  assert.ok(await owner.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '320px detail overflow')
  await shot(owner, 'detail.png')
  await owner.page.getByRole('button', { name: '새 번호 받기', exact: true }).click()
  await shot(owner, 'confirmation.png')
  await owner.page.keyboard.press('Escape')
  await expect(owner.page.getByRole('dialog')).toBeHidden()
  assert.equal(await owner.page.locator('.space-code').innerText(), oldCode)
  await confirm(owner, '새 번호 받기', '새 번호 받기')
  await expect(owner.page.locator('.space-code')).not.toHaveText(oldCode)
  const code = await owner.page.locator('.space-code').innerText()
  assert.equal((await request('/spaces/join', member, 'POST', { join_code: oldCode })).status, 404)
  console.log('PASS: 320px 배치 · 확인창 취소 · 번호 재발급 · 기존 번호 만료')

  const initialDefault = (await request('/auth/me', owner)).data.default_space_id
  await owner.page.getByRole('button', { name: '이 공간의 하루 보기', exact: true }).click()
  await expect(owner.page.locator('.space-switcher strong')).toHaveText('검증 우리 둘')
  assert.equal((await request('/auth/me', owner)).data.default_space_id, initialDefault)
  await owner.page.locator('.space-switcher').click()
  const personal = owner.page.locator('.space-card').filter({ hasText: '나만의 공간' })
  await personal.getByRole('button', { name: '이 공간으로 바꾸기', exact: true }).click()
  await go(owner, `/spaces/${spaceId}`)
  await owner.page.getByRole('button', { name: '앱을 시작할 때 이 공간 열기', exact: true }).click()
  await expect(owner.page.getByRole('button', { name: '처음 열 공간으로 지정됨', exact: true })).toBeDisabled()
  await owner.page.getByRole('link', { name: '뒤로 가기', exact: true }).click()
  await personal.getByRole('button', { name: '하루 보러 가기', exact: true }).click()
  await expect(owner.page.locator('.space-switcher strong')).not.toHaveText('검증 우리 둘')
  await owner.page.reload()
  await expect(owner.page.locator('.space-switcher strong')).toHaveText('검증 우리 둘')
  console.log('PASS: 현재 공간 전환 · 시작 공간 독립 설정 · 재접속 기본 공간')

  await go(owner, '/schedules/new')
  await owner.page.locator('#schedule-title').fill('함께 만든 검증 하루')
  const createdResponse = owner.page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/spaces/${spaceId}/schedules`))
  await owner.page.getByRole('button', { name: '갈 곳 정하기 →', exact: true }).click()
  const created = await createdResponse
  assert.equal(created.status(), 201)
  const schedule = await created.json()
  assert.equal(schedule.space_id, spaceId)
  await expect(owner.page).toHaveURL(new RegExp(`/schedules/${schedule.id}/plan$`))
  const sharedSchedules = await request(`/spaces/${spaceId}/schedules`, member)
  assert.equal(sharedSchedules.status, 200)
  assert.ok(sharedSchedules.data.items.some(item => item.id === schedule.id))
  const personalSchedules = await request(`/spaces/${initialDefault}/schedules`, owner)
  assert.equal(personalSchedules.status, 200)
  assert.ok(!personalSchedules.data.items.some(item => item.id === schedule.id))
  console.log('PASS: 공유 공간 하루 생성 · 두 계정 일정 공유 · 개인 공간 데이터 분리')

  await go(owner, `/spaces/${spaceId}`)
  await confirm(owner, '내보내기', '내보내기')
  await expect(owner.page.getByRole('heading', { name: '함께하는 사람 1명' })).toBeVisible()
  assert.equal((await request(`/spaces/${spaceId}`, member)).status, 404)
  assert.equal((await request(`/schedules/${schedule.id}`, member)).status, 404)
  assert.equal((await request(`/schedules/${schedule.id}`, owner)).status, 200)
  await go(member, '/spaces/join')
  await member.page.getByLabel('참여 번호', { exact: true }).fill(code)
  await member.page.getByRole('button', { name: '이 공간에 참여하기', exact: true }).click()
  await expect(member.page).toHaveURL(new RegExp(`/spaces/${spaceId}$`))
  assert.equal((await request(`/schedules/${schedule.id}`, member)).status, 200)
  await owner.page.reload()
  await confirm(owner, '주인 넘기기', '주인 넘기기')
  await expect(owner.page.getByRole('button', { name: '새 번호 받기', exact: true })).toHaveCount(0)
  await member.page.reload()
  await expect(member.page.getByRole('button', { name: '새 번호 받기', exact: true })).toBeVisible()
  await confirm(owner, '공간 나가기', '나가기')
  await expect(owner.page).toHaveURL(/\/spaces$/)
  assert.equal((await request('/auth/me', owner)).data.default_space_id, initialDefault)
  await member.page.reload()
  await expect(member.page.getByRole('heading', { name: '함께하는 사람 1명' })).toBeVisible()
  await confirm(member, '공간 나가기', '나가기')
  await expect(member.page).toHaveURL(/\/spaces$/)
  assert.equal((await request(`/spaces/${spaceId}`, member)).status, 404)
  assert.deepEqual(errors, [], 'Browser runtime errors')
  console.log('PASS: 멤버 내보내기 · 재참여 · 주인 이전 · 기본 공간 복구 · 마지막 멤버 나가기')
} finally {
  await Promise.all(contexts.map(context => context.close()))
  await browser.close()
}
