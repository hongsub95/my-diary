import { apiClient } from './client'

// 장소 API 호출. 명세는 docs/API_SPEC.md 6장이다.
//
// 장소는 두 층이다. Place는 지도상의 장소 그 자체이고, SchedulePlace는 그 장소를
// 이 일정에서 어떻게 다루는지(순서·메모·방문여부)다. 수정·삭제에 쓰는 id는 항상
// SchedulePlace 쪽이다(6.1절).

/**
 * 키워드로 장소를 찾는다.
 *
 * 지도 공급자가 확정되기 전까지 서버가 mock으로 답한다. 응답 구조는 실제와 같으므로
 * 공급자가 붙어도 이 화면은 그대로 동작한다.
 *
 * @param {string} query 검색어
 * @returns {Promise<{items: Array, provider: string}>} provider가 'mock'이면 아직 가짜다
 */
export async function searchPlaces(query) {
  const { data } = await apiClient.get('/places/search', { params: { query } })
  return data
}

export async function searchMapPlaces(query) {
  const [places, addresses] = await Promise.allSettled([
    searchPlaces(query), apiClient.get('/places/geocode', { params: { query } }),
  ])
  if (places.status === 'rejected' && addresses.status === 'rejected') throw places.reason
  if (places.status === 'fulfilled' && places.value.provider === 'mock' && addresses.status === 'rejected') throw addresses.reason
  return { provider: 'kakao', items: [
    ...(places.status === 'fulfilled' && places.value.provider !== 'mock' ? places.value.items : []),
    ...(addresses.status === 'fulfilled' ? addresses.value.data.items.map(item => ({ ...item, name: item.address, provider: 'manual', provider_place_id: null })) : []),
  ] }
}

export async function reverseAddress(point) {
  const { data } = await apiClient.get('/places/reverse-geocode', { params: point })
  return data.address
}

/**
 * 일정에 장소를 추가한다. 항상 맨 뒤에 붙는다.
 *
 * @param {object} params
 * @param {number|string} params.scheduleId 일정 id
 * @param {object} params.place 검색 결과 항목 그대로 또는 직접 입력한 값
 * @param {string} [params.memo] 이 일정에서만 쓰는 메모
 */
export async function addSchedulePlace({ scheduleId, place, memo }) {
  const { data } = await apiClient.post(`/schedules/${scheduleId}/places`, {
    name: place.name,
    address: place.address || null,
    address_detail: place.address_detail || null,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    // 검색 결과에서 온 값이면 출처를 함께 보내야 서버가 같은 장소를 재사용한다.
    provider: place.provider || 'manual',
    provider_place_id: place.provider_place_id ?? null,
    memo: memo || null,
  })
  return data
}

/**
 * 일정에서 장소를 뺀다.
 *
 * @param {object} params
 * @param {number|string} params.scheduleId 일정 id
 * @param {number} params.schedulePlaceId 뺄 항목의 id (장소 자체의 id가 아니다)
 */
export async function removeSchedulePlace({ scheduleId, schedulePlaceId }) {
  await apiClient.delete(`/schedules/${scheduleId}/places/${schedulePlaceId}`)
}

/**
 * 일정 속 장소의 방문 여부·메모를 바꾼다.
 *
 * @param {object} params
 * @param {number|string} params.scheduleId 일정 id
 * @param {number} params.schedulePlaceId 바꿀 항목의 id (장소 자체의 id가 아니다)
 * @param {object} params.changes 보낼 필드만 담은 객체 (visited, memo, planned_time)
 *
 * 장소 자체(이름·좌표)는 여기서 바꾸지 않는다. 같은 Place를 다른 일정도 참조하고 있어서
 * 한 일정에서 고치면 남의 기록까지 바뀐다(API_SPEC 6.5절).
 */
export async function updateSchedulePlace({ scheduleId, schedulePlaceId, changes }) {
  const { data } = await apiClient.patch(
    `/schedules/${scheduleId}/places/${schedulePlaceId}`,
    changes,
  )
  return data
}

/**
 * 일정 속 장소 순서를 한 번에 바꾼다.
 *
 * @param {object} params
 * @param {number|string} params.scheduleId 일정 id
 * @param {number[]} params.schedulePlaceIds 원하는 순서대로 담은 **전체** 목록
 * @returns {Promise<Array<object>>} 바뀐 전체 목록. 다시 조회할 필요가 없다
 *
 * **일부만 보내면 422다.** 그 일정의 장소를 빠짐없이 보내야 한다. 하나씩 sort_order를
 * 고치는 방식이 아닌 이유는 API_SPEC 6.4절에 있다 — 중간 상태가 꼬이고, 빠진 장소를
 * 앞뒤 어디에 둘지 정할 근거가 없다.
 */
export async function reorderSchedulePlaces({ scheduleId, schedulePlaceIds }) {
  const { data } = await apiClient.patch(`/schedules/${scheduleId}/places/reorder`, {
    schedule_place_ids: schedulePlaceIds,
  })
  return data.items
}

/**
 * 담은 장소를 가까운 순으로 다시 배열한 순서를 제안받는다. **일정은 바뀌지 않는다.**
 *
 * @param {object} params
 * @param {number|string} params.scheduleId 일정 id
 * @returns {Promise<object>} current / suggested / saved_distance_m / recommended / basis / skipped_place_ids
 *
 * 적용하려면 응답의 `suggested.schedule_place_ids`를 그대로 `reorderSchedulePlaces`에
 * 넘긴다. 두 API가 같은 목록을 주고받도록 맞춰져 있다.
 *
 * **직선거리 기준이다.** 실제 도로·도보 경로가 아니므로 화면에 근거를 함께 밝혀야 한다.
 * 응답의 `basis`가 그 값이며, 나중에 경로 API가 붙으면 값이 늘어난다.
 */
export async function previewPlaceOptimization({ scheduleId }) {
  const { data } = await apiClient.post(`/schedules/${scheduleId}/optimization-preview`)
  return data
}
