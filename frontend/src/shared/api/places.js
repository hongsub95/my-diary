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
