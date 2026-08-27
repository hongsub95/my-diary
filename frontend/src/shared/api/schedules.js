import { apiClient } from './client'

// 일정 API 호출만 담당한다. 응답을 화면이 쓰는 형태로 바꾸는 일은 scheduleAdapter.js가 한다.
// 명세는 docs/API_SPEC.md 5장(일정)과 6장(장소)이다.

/**
 * 기간별 일정 목록을 조회한다.
 *
 * @param {object} params
 * @param {string} params.spaceId 스페이스 공개 UUID (`/auth/me`의 default_space_id)
 * @param {string} [params.from] 조회 시작일 `YYYY-MM-DD`. 생략하면 이번 달 1일
 * @param {string} [params.to] 조회 종료일 `YYYY-MM-DD`. 생략하면 from이 속한 달의 말일
 * @param {boolean} [params.includePlaces] true면 각 일정에 장소가 방문 순서대로 담긴다
 * @returns {Promise<Array>} 서버 응답의 items 원본
 */
export async function listSchedules({ spaceId, from, to, includePlaces = false }) {
  // from/to는 날짜만 보낸다. 한국 시간 기준 하루로 해석하는 일은 서버가 한다(API_SPEC 5.1).
  const { data } = await apiClient.get(`/spaces/${spaceId}/schedules`, {
    params: {
      from,
      to,
      ...(includePlaces ? { include: 'places' } : {}),
    },
  })
  return data.items
}

/**
 * 일정 상세를 조회한다. 상세 응답에는 장소가 담기지 않는다.
 *
 * @param {number|string} scheduleId 일정 id (정수)
 */
export async function getSchedule(scheduleId) {
  const { data } = await apiClient.get(`/schedules/${scheduleId}`)
  return data
}

/**
 * 일정의 장소를 방문 순서대로 조회한다.
 *
 * 상세 화면이 목록과 따로 부르는 이유: 상세 조회는 `include`를 받지 않는다(API_SPEC 5.2).
 *
 * @param {number|string} scheduleId 일정 id
 */
export async function listSchedulePlaces(scheduleId) {
  const { data } = await apiClient.get(`/schedules/${scheduleId}/places`)
  return data.items
}

/**
 * 일정을 만든다.
 *
 * @param {object} params
 * @param {string} params.spaceId 일정이 속할 스페이스 UUID
 * @param {string} params.title 제목
 * @param {string|null} [params.description] 메모
 * @param {string} params.startAt 시작 시각 (UTC ISO)
 * @param {string} params.endAt 종료 시각 (UTC ISO)
 * @returns {Promise<object>} 생성된 일정 원본
 */
export async function createSchedule({ spaceId, title, description, startAt, endAt }) {
  const { data } = await apiClient.post(`/spaces/${spaceId}/schedules`, {
    title,
    description: description || null,
    start_at: startAt,
    end_at: endAt,
  })
  return data
}
