import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import RecommendationResults from './RecommendationResults'
import { formatCourseLeg, recommendedIndexes, recommendationReturnPath, relaxConditions, toBatchPlaces } from './recommendationModel'
import { createCourseSaver, insertBeforeAnchor } from './courseSave'
import { createCourseSaver as createMobileCourseSaver, insertBeforeAnchor as insertMobileBeforeAnchor } from '../../../../mobile/src/features/recommendations/course-save'

const place = (name, kind = 'recommended') => ({
  name, kind, address: '서울 성동구', latitude: '37.5446001234', longitude: '127.0561001234',
  provider: 'kakao', provider_place_id: name, category: 'cafe',
  reason: '기준 장소에서 직선 120m', warnings: kind === 'anchor' ? [] : ['BUSINESS_HOURS_UNVERIFIED'],
})
const anchor = place('이미 담은 곳', 'anchor')
const candidates = [
  { rank: 1, total_distance_m: 120, places: [anchor, place('첫 카페')], legs: [{ from_index: 0, to_index: 1, distance_m: 120 }] },
  { rank: 2, total_distance_m: 1450, places: [place('다른 카페'), place('다음 카페'), anchor], legs: [{ from_index: 0, to_index: 1, distance_m: 700 }, { from_index: 1, to_index: 2, distance_m: 750 }] },
  { rank: 3, total_distance_m: 0, places: [place('한 곳만')], legs: [] },
]
const conditions = { anchor: { schedule_place_id: 42, position: 'before' }, radius_m: 1000, party_size: '2', items: [{ category: 'cafe', subcategory: 'dessert' }, { category: 'food', subcategory: 'korean' }] }
const noop = () => {}
function render(candidate, count = 3, extra = {}) {
  return renderToStaticMarkup(<RecommendationResults result={{ center: { label: '성수' }, candidates: candidates.slice(0, count) }} selected={candidate} options={{ categories: [{ code: 'cafe', label: '카페·디저트' }] }} conditions={conditions} busy={false} saving={false} checkedIndexes={recommendedIndexes(candidate)} placementPending={false} onTogglePlace={noop} onChoose={noop} onRefresh={noop} onSave={noop} onSelectPlace={noop} onNotice={noop} {...extra} />)
}

test('saving excludes the anchor at either end and preserves provider IDs, coordinates and visit order', () => {
  for (const candidate of candidates.slice(0, 2)) {
    const places = toBatchPlaces(candidate)
    assert.deepEqual(places.map(item => item.name), candidate.places.filter(item => item.kind === 'recommended').map(item => item.name))
    assert.equal(places[0].latitude, '37.5446001234')
    assert.equal(places[0].provider_place_id, places[0].name)
    assert.ok(!places.some(item => item.name === anchor.name))
    assert.deepEqual(Object.keys(places[0]).sort(), ['address', 'latitude', 'longitude', 'name', 'provider', 'provider_place_id'].sort())
  }
})

test('relaxation changes only the requested radius or item subcategory without altering the original input', () => {
  const original = structuredClone(conditions)
  const wider = relaxConditions(conditions, { code: 'WIDEN_RADIUS', radius_m: 2000 })
  assert.deepEqual(wider, { ...original, radius_m: 2000 })
  const any = relaxConditions(conditions, { code: 'USE_ANY_SUBCATEGORY', item_index: 1 })
  assert.deepEqual(any.items, [original.items[0], { ...original.items[1], subcategory: 'any' }])
  assert.deepEqual(any.anchor, original.anchor)
  assert.deepEqual(conditions, original)
})

test('the result view renders the actual candidate count for one, two and three alternatives', () => {
  for (const count of [1, 2, 3]) {
    const html = render(candidates[0], count)
    assert.equal((html.match(/aria-pressed=/g) ?? []).length, count)
    assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1)
    assert.match(html, /영업시간 확인 필요/)
    assert.match(html, /직선거리 120m/)
    assert.match(html, /기준 장소 · 이미 담은 곳/)
    assert.match(html, /코스 1 · 1곳/)
    assert.doesNotMatch(html, /도보 \d+분|예상 \d+분|절약 \d+분/)
  }
})

test('choosing a different candidate changes route, map labels and save count consistently', () => {
  const html = render(candidates[1])
  const route = html.split('class="course-route"')[1].split('class="course-note"')[0]
  assert.match(route, /다른 카페/)
  assert.match(route, /다음 카페/)
  assert.doesNotMatch(route, /첫 카페/)
  assert.match(html, /aria-label="1번 다른 카페 지도에서 보기"/)
  assert.match(html, /코스 2 · 2곳/)
  assert.match(html, /기준 장소 바로 앞에 배치/)
  const single = render(candidates[2])
  assert.doesNotMatch(single, /class="course-leg"/)
  assert.match(single, /코스 3 · 1곳/)
})

test('missing leg information is not presented as zero distance, and pending saves are disabled', () => {
  assert.equal(formatCourseLeg(undefined), '거리 확인 필요')
  assert.equal(formatCourseLeg(0), '직선거리 0m')
  const html = render({ ...candidates[0], legs: [] }, 3, { busy: true, saving: true })
  assert.match(html, /거리 확인 필요/)
  assert.match(html, /class="course-primary" disabled=""/)
  assert.match(html, /저장하는 중/)
})

test('only checked recommended places are saved in course order, and zero selection prevents saving', () => {
  assert.deepEqual(toBatchPlaces(candidates[1], [1, 2]).map(item => item.name), ['다음 카페'])
  assert.deepEqual(toBatchPlaces(candidates[1], [1, 0]).map(item => item.name), ['다른 카페', '다음 카페'])
  assert.deepEqual(toBatchPlaces(candidates[1], []), [])
  const html = render(candidates[1], 3, { checkedIndexes: [1] })
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 2)
  assert.equal((html.match(/checked=""/g) ?? []).length, 1)
  assert.match(html, /코스 2 · 1곳 선택/)
  assert.match(render(candidates[1], 3, { checkedIndexes: [] }), /class="course-primary" disabled=""/)
})

test('leg distances use the shared ten-meter format', () => {
  assert.equal(formatCourseLeg(47), '직선거리 50m')
  assert.equal(formatCourseLeg(1450), '직선거리 1.4km')
})

test('return destinations preserve the place-planning step and reject arbitrary destinations', () => {
  assert.equal(recommendationReturnPath(42, 'plan'), '/schedules/42/plan')
  assert.equal(recommendationReturnPath(42, null), '/schedules/42')
  assert.equal(recommendationReturnPath(42, 'https://example.com'), '/schedules/42')
})

const stored = (id, name) => ({ id, place: { ...place(name), id: id + 1000 } })
for (const [platform, createSaver, insert] of [['web', createCourseSaver, insertBeforeAnchor], ['mobile', createMobileCourseSaver, insertMobileBeforeAnchor]]) {
  test(`${platform}: selected places are inserted before the anchor using SchedulePlace IDs and all existing places are preserved`, async () => {
    const existing = [stored(10, '기존 첫 장소'), stored(42, '기준 장소'), stored(30, '기존 마지막 장소')]
    const added = [stored(81, '다른 카페'), stored(82, '다음 카페')]
    const otherMember = stored(83, '다른 멤버가 추가한 곳')
    const payload = toBatchPlaces(candidates[1], [0, 1])
    let sentOrder
    let sentPayload
    const pending = []
    const save = createSaver({
      listPlaces: async () => existing,
      addPlaces: async places => { sentPayload = places; return [...existing, ...added, otherMember] },
      reorderPlaces: async ids => { sentOrder = ids },
      onPendingChange: value => pending.push(value),
    })
    await save(payload, conditions.anchor)
    assert.deepEqual(sentPayload, payload)
    assert.deepEqual(sentOrder, [10, 81, 82, 42, 30, 83])
    assert.deepEqual(pending, [true, false])
    assert.throws(() => insert(existing, [81], 42), /장소가 변경/)
  })

  test(`${platform}: retry after reorder failure never adds again and preserves newly added or moved places`, async () => {
    const existing = [stored(10, '기존 첫 장소'), stored(42, '기준 장소')]
    const added = stored(81, '다른 카페')
    const payload = toBatchPlaces(candidates[1], [0])
    let additions = 0
    let reorderCalls = 0
    let reads = 0
    const pending = []
    const save = createSaver({
      listPlaces: async () => ++reads === 1 ? existing : [stored(90, '새로 추가된 곳'), ...existing, added],
      addPlaces: async () => { additions++; return [...existing, added] },
      reorderPlaces: async ids => {
        if (++reorderCalls === 1) throw new Error('network failure')
        assert.deepEqual(ids, [90, 10, 81, 42])
      },
      onPendingChange: value => pending.push(value),
    })
    await assert.rejects(save(payload, conditions.anchor), /장소는 담았지만/)
    assert.deepEqual(pending, [true])
    await save(payload, conditions.anchor)
    assert.equal(additions, 1)
    assert.equal(reorderCalls, 2)
    assert.deepEqual(pending, [true, false])
  })

  test(`${platform}: after-anchor recommendations append without reorder, and missing anchors or empty selections do not write`, async () => {
    let writes = 0
    const save = createSaver({
      listPlaces: async () => [],
      addPlaces: async () => { writes++; return [] },
      reorderPlaces: async () => assert.fail('must not reorder'),
      onPendingChange: () => assert.fail('must not enter insertion recovery'),
    })
    await assert.rejects(save([], conditions.anchor), /하나 이상/)
    await assert.rejects(save(toBatchPlaces(candidates[1]), conditions.anchor), /기준 장소가 변경/)
    assert.equal(writes, 0)
    await save(toBatchPlaces(candidates[1]), { schedule_place_id: 42, position: 'after' })
    assert.equal(writes, 1)
  })
}
