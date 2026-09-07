import { apiClient } from './client'

// 일기 API 호출. 명세는 docs/API_SPEC.md 7장이다.
//
// 하루의 일기는 세 갈래다. 본문은 작성자별이고, 사진과 타임라인은 하루 공용이다.

/**
 * 기록 탭 목록을 한 페이지 가져온다.
 *
 * @param {object} params
 * @param {string} params.spaceId 스페이스 공개 UUID
 * @param {string} [params.cursor] 이전 응답의 next_cursor. 없으면 처음부터
 * @param {number} [params.limit] 한 페이지 개수 (1~50)
 * @param {boolean} [params.includePending] 아직 기록이 없는 지난 하루도 포함할지
 * @returns {Promise<{items: Array, next_cursor: string|null}>}
 *
 * cursor는 서버가 준 값을 **해석하지 말고 그대로** 돌려준다. 내용을 뜯어보기 시작하면
 * 서버가 정렬 기준을 바꿀 때 화면이 함께 깨진다.
 */
export async function listSpaceDiaries({ spaceId, cursor, limit, includePending = false }) {
  const { data } = await apiClient.get(`/spaces/${spaceId}/diaries`, {
    params: {
      cursor,
      limit,
      ...(includePending ? { include_pending: true } : {}),
    },
  })
  return data
}

/**
 * 한 일정에 달린 작성자별 본문을 모두 가져온다.
 *
 * @param {number|string} scheduleId 일정 id
 */
export async function listDiaryEntries(scheduleId) {
  const { data } = await apiClient.get(`/schedules/${scheduleId}/diaries`)
  return data.items
}

/**
 * 하루의 사진 목록.
 *
 * @param {number|string} scheduleId 일정 id
 */
export async function listDiaryPhotos(scheduleId) {
  const { data } = await apiClient.get(`/schedules/${scheduleId}/diary/photos`)
  return data.photos
}

/**
 * 하루의 방문 타임라인.
 *
 * @param {number|string} scheduleId 일정 id
 */
export async function listDiaryTimeline(scheduleId) {
  const { data } = await apiClient.get(`/schedules/${scheduleId}/diary/timeline`)
  return data.items
}

/**
 * 내 본문을 쓰거나 고친다.
 *
 * @param {object} params
 * @param {number|string} params.scheduleId 일정 id
 * @param {string} params.content 본문
 * @param {string|null} [params.mood] 기분
 *
 * 생성과 수정을 나누지 않는다. 작성자당 본문이 하나뿐이라 "내가 이미 썼나"를 먼저
 * 확인할 필요가 없다. 경로에 작성자 id가 없어 남의 글은 지목조차 할 수 없다.
 */
export async function upsertDiaryEntry({ scheduleId, content, mood }) {
  const { data } = await apiClient.put(`/schedules/${scheduleId}/diary`, {
    content,
    mood: mood || null,
  })
  return data
}

/**
 * 내 본문을 지운다. 같은 하루에 남이 쓴 글과 공용 사진·타임라인은 남는다.
 *
 * @param {number|string} scheduleId 일정 id
 */
export async function deleteDiaryEntry(scheduleId) {
  await apiClient.delete(`/schedules/${scheduleId}/diary`)
}

/**
 * 사진을 올린다. 본문이 없어도 사진만 올릴 수 있다.
 *
 * @param {object} params
 * @param {number|string} params.scheduleId 일정 id
 * @param {File[]} params.files 이미지 파일들
 * @returns {Promise<Array>} 이번에 올린 사진들
 *
 * 필드명은 `files`이며 여러 장을 한 번에 보낸다. Content-Type은 브라우저가
 * multipart 경계값과 함께 붙이므로 직접 지정하지 않는다.
 */
export async function uploadDiaryPhotos({ scheduleId, files }) {
  const form = new FormData()
  for (const file of files) form.append('files', file)

  const { data } = await apiClient.post(`/schedules/${scheduleId}/diary/photos`, form)
  return data.photos
}

/**
 * 사진을 지운다. 업로더와 스페이스 owner만 지울 수 있다.
 *
 * @param {number} photoId 사진 id
 */
export async function deleteDiaryPhoto(photoId) {
  await apiClient.delete(`/diary-photos/${photoId}`)
}

/**
 * 타임라인 항목을 추가한다.
 *
 * @param {object} params
 * @param {number|string} params.scheduleId 일정 id
 * @param {string} params.occurredAt 실제 시각 (UTC ISO)
 * @param {string} params.title 무엇을 했는지
 * @param {string|null} [params.memo] 메모
 * @param {number|null} [params.schedulePlaceId] 일정에 담아둔 장소와 연결할 때만
 *
 * 장소 연결은 선택이다. 계획에 없던 곳이나 장소가 아닌 활동("점심 먹기")도 남길 수 있다.
 */
export async function addTimelineItem({ scheduleId, occurredAt, title, memo, schedulePlaceId }) {
  const { data } = await apiClient.post(`/schedules/${scheduleId}/diary/timeline`, {
    occurred_at: occurredAt,
    title,
    memo: memo || null,
    schedule_place_id: schedulePlaceId ?? null,
  })
  return data
}

/**
 * 타임라인 항목을 지운다. 작성자와 스페이스 owner만 지울 수 있다.
 *
 * @param {number} itemId 항목 id
 */
export async function deleteTimelineItem(itemId) {
  await apiClient.delete(`/diary-timeline/${itemId}`)
}
