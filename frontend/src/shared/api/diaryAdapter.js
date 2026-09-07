import { toServiceDateKey } from './scheduleAdapter'

// 기록 응답을 화면이 쓰는 형태로 바꾸는 자리.
//
// 화면 컴포넌트가 API 응답 구조에 직접 의존하지 않게 한다는 결정(docs/DEVELOPMENT_BRIEF.md
// 7절)에 따른 것이다. 일정 어댑터(scheduleAdapter.js)와 같은 역할이며, 날짜 규칙도
// 그쪽 것을 그대로 쓴다.

const dateLabelFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

/**
 * 기록 카드 하나를 화면용으로 바꾼다.
 *
 * @param {object} item 서버의 기록 목록 항목
 * @returns {object} 화면이 쓰는 기록 카드 모델
 */
export function toRecordView(item) {
  const summary = item.record_summary

  return {
    scheduleId: item.schedule_id,
    title: item.title,
    // 카드에 찍을 날짜는 정렬 기준과 같은 시각을 쓴다. 목록 순서와 표시 날짜가 다르면
    // "왜 이 카드가 여기 있지?"가 된다.
    dateKey: toServiceDateKey(item.sorted_at),
    dateLabel: dateLabelFormatter.format(new Date(item.sorted_at)),
    phase: item.experience_phase,
    placeCount: item.place_count,
    // 본문을 쓴 사람들. 사진만 남긴 하루는 빈 배열이다.
    authorNames: item.authors.map((author) => author.nickname),
    photoCount: summary.photo_count,
    timelineCount: summary.timeline_count,
    hasDiaryText: summary.has_diary_text,
    // 썸네일이 아직 없으면 서버가 원본 URL을 대신 담아 준다. 화면은 이 값만 보면 된다.
    coverUrl: summary.cover_thumbnail_url,
    excerpt: summary.diary_excerpt,
  }
}

/**
 * 기록 목록 한 페이지를 화면용으로 바꾼다.
 *
 * @param {{items: Array, next_cursor: string|null}} page 서버 응답
 */
export function toRecordPage(page) {
  return {
    records: page.items.map(toRecordView),
    // 다음 페이지 커서. 해석하지 않고 그대로 다음 요청에 넘긴다.
    nextCursor: page.next_cursor,
  }
}
