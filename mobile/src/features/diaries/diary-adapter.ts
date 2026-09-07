import type { DiaryFeedItem, DiaryFeedResponse } from '@/shared/api/types';
import { seoulDateKey } from '@/shared/utils/date';

// 기록 응답을 화면이 쓰는 형태로 바꾸는 자리.
//
// 웹의 frontend/src/shared/api/diaryAdapter.js와 같은 모양으로 맞춰 두었다. 두
// 클라이언트가 같은 값을 다르게 계산하기 시작하면 화면이 어긋난다.

const dateLabelFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

/** 화면이 쓰는 기록 카드 하나. */
export type RecordView = {
  scheduleId: number;
  title: string;
  dateKey: string;
  dateLabel: string;
  phase: string;
  placeCount: number;
  /** 본문을 쓴 사람들. 사진만 남긴 하루는 빈 배열이다 */
  authorNames: string[];
  photoCount: number;
  timelineCount: number;
  hasDiaryText: boolean;
  coverUrl: string | null;
  excerpt: string | null;
};

export type RecordPage = {
  records: RecordView[];
  /** 다음 페이지 커서. 해석하지 않고 그대로 다음 요청에 넘긴다 */
  nextCursor: string | null;
};

/**
 * 기록 카드 하나를 화면용으로 바꾼다.
 *
 * 카드에 찍을 날짜는 정렬 기준(sorted_at)과 같은 시각을 쓴다. 목록 순서와 표시 날짜가
 * 다르면 "왜 이 카드가 여기 있지?"가 된다.
 */
export function toRecordView(item: DiaryFeedItem): RecordView {
  const summary = item.record_summary;

  return {
    scheduleId: item.schedule_id,
    title: item.title,
    dateKey: seoulDateKey(item.sorted_at),
    dateLabel: dateLabelFormatter.format(new Date(item.sorted_at)),
    phase: item.experience_phase,
    placeCount: item.place_count,
    authorNames: item.authors.map((author) => author.nickname),
    photoCount: summary.photo_count,
    timelineCount: summary.timeline_count,
    hasDiaryText: summary.has_diary_text,
    // 썸네일이 아직 없으면 서버가 원본 URL을 대신 담아 준다. 화면은 이 값만 보면 된다.
    coverUrl: summary.cover_thumbnail_url,
    excerpt: summary.diary_excerpt,
  };
}

/** 기록 목록 한 페이지를 화면용으로 바꾼다. */
export function toRecordPage(page: DiaryFeedResponse): RecordPage {
  return {
    records: page.items.map(toRecordView),
    nextCursor: page.next_cursor,
  };
}
