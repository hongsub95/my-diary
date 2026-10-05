import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AxiosError } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuthProvider } from '../../shared/contexts/AuthContext'
import { apiClient } from '../../shared/api/client'
import * as webApi from '../../shared/api/spaces'
import * as mobileApi from '../../../../mobile/src/features/spaces/space-api'
import * as webModel from './spaceModel'
import * as mobileModel from '../../../../mobile/src/features/spaces/space-model'
import { SpaceProvider, useSpaces } from './SpaceContext'

const personal = { id: 'personal-uuid', type: 'personal', name: '나의 일정', icon: null, join_code: null, member_count: 1, my_role: 'owner', is_default: true }
const shared = { ...personal, id: 'shared-uuid', type: 'shared', name: '우리 둘', join_code: 'K7M2QX9P', member_count: 2, is_default: false }
for (const [platform, model] of [['web', webModel], ['mobile', mobileModel]]) {
  test(`${platform}: temporary switching does not change startup space; inaccessible selections fall back`, () => {
    const spaces = [personal, shared]
    assert.equal(model.resolveCurrentSpace(spaces, null, personal.id).id, personal.id)
    assert.equal(model.resolveCurrentSpace(spaces, shared.id, personal.id).id, shared.id)
    assert.equal(personal.is_default, true)
    assert.equal(shared.is_default, false)
    assert.equal(model.resolveCurrentSpace([personal], shared.id, shared.id).id, personal.id)
    assert.equal(model.resolveCurrentSpace([], shared.id, shared.id), null)
    assert.equal(model.resolveCurrentSpace(undefined, null, null), null)
  })
  test(`${platform}: only shared owners manage members; owners with others must transfer before leaving`, () => {
    assert.equal(model.spacePermissions(personal).canManage, false)
    assert.equal(model.spacePermissions(shared).canManage, true)
    assert.equal(model.spacePermissions(shared).mustTransfer, true)
    assert.equal(model.spacePermissions({ ...shared, member_count: 1 }).mustTransfer, false)
    assert.equal(model.spacePermissions({ ...shared, my_role: 'member' }).canManage, false)
    assert.equal(model.spacePermissions({ ...shared, my_role: 'member' }).mustTransfer, false)
  })
  test(`${platform}: join input accepts lowercase and separators, rejecting ambiguous characters; names use Unicode character length`, () => {
    assert.equal(model.normalizeJoinCode(' k7m2-qx9p '), 'K7M2QX9P')
    assert.equal(model.spaceInputError(' k7m2-qx9p ', true), null)
    for (const value of ['', '5830194276', 'O7M2QX9P', 'I7M2QX9P', 'L7M2QX9P', 'K7M2QX9']) assert.ok(model.spaceInputError(value, true))
    assert.ok(model.spaceInputError('   ', false))
    assert.ok(model.spaceInputError('가'.repeat(31), false))
    assert.equal(model.spaceInputError('♡'.repeat(30), false), null)
    assert.equal(model.spaceInputError('🌷'.repeat(30), false), null)
  })
}

test('SpaceProvider can mount before authentication without crashing or exposing a previous selection', () => {
  function CurrentSpace() { return <span>{useSpaces().currentSpaceId ?? 'none'}</span> }
  const queryClient = new QueryClient()
  const html = renderToStaticMarkup(<QueryClientProvider client={queryClient}><AuthProvider><SpaceProvider><CurrentSpace /></SpaceProvider></AuthProvider></QueryClientProvider>)
  assert.equal(html, '<span>none</span>')
  queryClient.clear()
})

for (const [platform, api] of [['web', webApi], ['mobile', mobileApi]]) {
  test(`${platform}: space UI API calls use UUID paths, member integer IDs, correct bodies and response wrappers`, async () => {
    const requests = []
    const original = apiClient.defaults.adapter
    apiClient.defaults.adapter = async config => {
      requests.push({ method: config.method, url: config.url, body: config.data ? JSON.parse(config.data) : undefined })
      const data = config.url.endsWith('/members') ? { members: [{ user_id: 5 }] }
        : config.url.endsWith('/regenerate') ? { join_code: 'P7M2QX9K' }
          : config.method === 'get' && config.url === '/spaces' ? { spaces: [shared] } : shared
      return { data, status: 200, statusText: 'OK', headers: {}, config }
    }
    try {
      assert.deepEqual(await api.listSpaces(), [shared])
      assert.deepEqual(await api.getSpace(shared.id), shared)
      await api.createSpace({ name: '우리 둘', icon: 'heart' })
      await api.joinSpace('K7M2QX9P')
      assert.deepEqual(await api.regenerateJoinCode(shared.id), { join_code: 'P7M2QX9K' })
      assert.deepEqual(await api.listMembers(shared.id), [{ user_id: 5 }])
      await api.removeMember(shared.id, 5)
      await api.transferOwnership(shared.id, 5)
      await api.leaveSpace(shared.id)
      assert.deepEqual(await api.setDefaultSpace(shared.id), shared)
      assert.deepEqual(requests, [
        { method: 'get', url: '/spaces', body: undefined },
        { method: 'get', url: '/spaces/shared-uuid', body: undefined },
        { method: 'post', url: '/spaces', body: { name: '우리 둘', icon: 'heart' } },
        { method: 'post', url: '/spaces/join', body: { join_code: 'K7M2QX9P' } },
        { method: 'post', url: '/spaces/shared-uuid/join-code/regenerate', body: undefined },
        { method: 'get', url: '/spaces/shared-uuid/members', body: undefined },
        { method: 'delete', url: '/spaces/shared-uuid/members/5', body: undefined },
        { method: 'post', url: '/spaces/shared-uuid/transfer-ownership', body: { user_id: 5 } },
        { method: 'post', url: '/spaces/shared-uuid/leave', body: undefined },
        { method: 'put', url: '/users/me/default-space', body: { space_id: 'shared-uuid' } },
      ])
    } finally { apiClient.defaults.adapter = original }
  })
  test(`${platform}: server rejection remains available for the snackbar and existing-membership recovery`, async () => {
    const original = apiClient.defaults.adapter
    apiClient.defaults.adapter = async config => {
      throw new AxiosError('Already a member', 'ERR_BAD_REQUEST', config, null, { data: { code: 'ALREADY_MEMBER', message: '이미 참여 중인 스페이스입니다.', field: 'join_code' }, status: 409, statusText: 'Conflict', headers: {}, config })
    }
    try { await assert.rejects(api.joinSpace('K7M2QX9P'), error => error.response.data.code === 'ALREADY_MEMBER') }
    finally { apiClient.defaults.adapter = original }
  })
}
