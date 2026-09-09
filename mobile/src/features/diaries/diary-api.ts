import { apiClient } from '@/shared/api/client';
import type {
  DiaryEntry,
  DiaryEntryListResponse,
  DiaryFeedResponse,
  DiaryPhoto,
  DiaryPhotoListResponse,
  DiaryTimelineItem,
  DiaryTimelineListResponse,
} from '@/shared/api/types';

// 일기 API 호출만 담당한다. 응답을 화면 형태로 바꾸는 일은 diary-adapter.ts가 한다.
// 명세는 docs/API_SPEC.md 7장이며, 웹의 frontend/src/shared/api/diaries.js와 같은 규격이다.

export type ListSpaceDiariesParams = {
  /** 스페이스 공개 UUID. /auth/me의 default_space_id를 그대로 쓴다 */
  spaceId: string;
  /** 이전 응답의 next_cursor. 없으면 처음부터 */
  cursor?: string;
  /** 아직 기록이 없는 지난 하루도 포함할지 */
  includePending?: boolean;
};

/**
 * 기록 탭 목록을 한 페이지 가져온다.
 *
 * cursor는 서버가 준 값을 **해석하지 말고 그대로** 돌려준다. 내용을 뜯어보기 시작하면
 * 서버가 정렬 기준을 바꿀 때 앱이 함께 깨진다.
 */
export async function listSpaceDiaries({
  spaceId,
  cursor,
  includePending = false,
}: ListSpaceDiariesParams): Promise<DiaryFeedResponse> {
  const response = await apiClient.get<DiaryFeedResponse>(`/spaces/${spaceId}/diaries`, {
    params: {
      cursor,
      ...(includePending ? { include_pending: true } : {}),
    },
  });
  return response.data;
}

/** 한 일정에 달린 작성자별 본문을 모두 가져온다. */
export async function listDiaryEntries(scheduleId: number): Promise<DiaryEntry[]> {
  const response = await apiClient.get<DiaryEntryListResponse>(`/schedules/${scheduleId}/diaries`);
  return response.data.items;
}

/** 하루의 사진 목록. 작성자 구분 없이 공용이다. */
export async function listDiaryPhotos(scheduleId: number): Promise<DiaryPhoto[]> {
  const response = await apiClient.get<DiaryPhotoListResponse>(
    `/schedules/${scheduleId}/diary/photos`,
  );
  return response.data.photos;
}

/** 하루의 방문 타임라인. 시간순이다. */
export async function listDiaryTimeline(scheduleId: number): Promise<DiaryTimelineItem[]> {
  const response = await apiClient.get<DiaryTimelineListResponse>(
    `/schedules/${scheduleId}/diary/timeline`,
  );
  return response.data.items;
}

/**
 * 내 본문을 쓰거나 고친다.
 *
 * 생성과 수정을 나누지 않는다. 작성자당 본문이 하나뿐이라 "내가 이미 썼나"를 먼저
 * 확인할 필요가 없고, 경로에 작성자 id가 없어 남의 글은 지목조차 할 수 없다.
 */
export async function upsertDiaryEntry(
  scheduleId: number,
  content: string,
  mood: string | null,
): Promise<DiaryEntry> {
  const response = await apiClient.put<DiaryEntry>(`/schedules/${scheduleId}/diary`, {
    content,
    mood: mood || null,
  });
  return response.data;
}

/** 내 본문을 지운다. 남이 쓴 글과 공용 사진·타임라인은 남는다. */
export async function deleteDiaryEntry(scheduleId: number): Promise<void> {
  await apiClient.delete(`/schedules/${scheduleId}/diary`);
}

/** 갤러리에서 고른 사진 하나. 업로드에 필요한 정보만 담는다. */
export type PickedPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
};

/**
 * 사진을 올린다. 본문이 없어도 사진만 올릴 수 있다.
 *
 * React Native의 FormData는 파일을 { uri, name, type } 객체로 받는다. 웹처럼 File
 * 객체를 만들 수 없어서, 갤러리가 준 로컬 uri를 그대로 넘기면 네이티브가 읽어 보낸다.
 */
export async function uploadDiaryPhotos(
  scheduleId: number,
  photos: PickedPhoto[],
): Promise<DiaryPhoto[]> {
  const form = new FormData();
  for (const photo of photos) {
    form.append('files', {
      uri: photo.uri,
      name: photo.fileName,
      type: photo.mimeType,
    } as unknown as Blob);
  }

  const response = await apiClient.post<DiaryPhotoListResponse>(
    `/schedules/${scheduleId}/diary/photos`,
    form,
  );
  return response.data.photos;
}

/** 사진을 지운다. 업로더와 스페이스 owner만 지울 수 있다. */
export async function deleteDiaryPhoto(photoId: number): Promise<void> {
  await apiClient.delete(`/diary-photos/${photoId}`);
}

export type NewTimelineItem = {
  /** 실제 시각 (UTC ISO) */
  occurredAt: string;
  title: string;
  memo: string | null;
  /** 일정에 담아둔 장소와 연결할 때만. 계획에 없던 곳은 title만으로 남긴다 */
  schedulePlaceId: number | null;
};

/** 타임라인 항목을 추가한다. */
export async function addTimelineItem(
  scheduleId: number,
  item: NewTimelineItem,
): Promise<DiaryTimelineItem> {
  const response = await apiClient.post<DiaryTimelineItem>(
    `/schedules/${scheduleId}/diary/timeline`,
    {
      occurred_at: item.occurredAt,
      title: item.title,
      memo: item.memo || null,
      schedule_place_id: item.schedulePlaceId,
    },
  );
  return response.data;
}

/** 타임라인 항목을 지운다. 작성자와 스페이스 owner만 지울 수 있다. */
export async function deleteTimelineItem(itemId: number): Promise<void> {
  await apiClient.delete(`/diary-timeline/${itemId}`);
}
