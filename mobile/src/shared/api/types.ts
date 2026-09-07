export type ApiValidationDetail = {
  field: string | null;
  message: string;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  field: string | null;
  details?: ApiValidationDetail[];
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer' | string;
};

export type User = {
  id: number;
  email: string;
  nickname: string;
  // 스페이스의 공개 UUID. 그대로 /spaces/{id}/schedules 경로에 넣어 쓸 수 있다.
  default_space_id: SpaceId | null;
  created_at: string;
};

export type RegisterResponse = {
  user: User;
  tokens: TokenPair;
};

export type MenuItem = {
  code: string;
  name: string;
  icon: string | null;
  path: string | null;
  children: MenuItem[];
};

export type MenuListResponse = { menus: MenuItem[] };

export type SpaceId = string;

export type Schedule = {
  id: number;
  space_id: SpaceId;
  space_name: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  status: 'planned' | 'completed' | 'canceled';
  created_by: { id: number; nickname: string };
  place_count: number;
  has_diary: boolean;
  // 목록 조회에서 include=places를 줬을 때만 채워진다. null은 "요청하지 않았다",
  // 빈 배열은 "요청했는데 장소가 없다"로 뜻이 다르다 (API_SPEC 5.2절).
  places: SchedulePlace[] | null;
};

/** 지도상의 장소 그 자체. 여러 일정이 같은 장소를 공유한다. */
export type Place = {
  id: number;
  name: string;
  address: string | null;
  // 정밀도 손실을 막으려고 문자열로 내려온다. 지도에 쓸 때 숫자로 바꾼다 (API_SPEC 6.2절).
  latitude: string | null;
  longitude: string | null;
  provider: string;
  provider_place_id: string | null;
};

/** 일정에 담긴 장소 하나. id는 Place가 아니라 이 항목의 id다 (API_SPEC 6.1절). */
export type SchedulePlace = {
  id: number;
  place: Place;
  sort_order: number;
  planned_time: string | null;
  memo: string | null;
  visited: boolean;
};

export type ScheduleListResponse = { items: Schedule[] };
export type SchedulePlaceListResponse = { items: SchedulePlace[] };

/** 이 하루에 기록이 얼마나 남았는지 요약. 카드를 그리는 데 필요한 만큼만 담긴다. */
export type DiaryRecordSummary = {
  has_content: boolean;
  has_diary_text: boolean;
  photo_count: number;
  timeline_count: number;
  // 썸네일을 아직 만들지 않아 당분간 원본 URL이 온다. 화면은 이 값만 보면 된다.
  cover_thumbnail_url: string | null;
  diary_excerpt: string | null;
};

/** 기록 탭 카드 하나. */
export type DiaryFeedItem = {
  schedule_id: number;
  title: string;
  start_at: string;
  end_at: string;
  // 목록을 늘어놓은 기준 시각. completed_at이 있으면 그 값, 없으면 end_at이다.
  sorted_at: string;
  completed_at: string | null;
  experience_phase: string;
  place_count: number;
  // 본문을 쓴 사람들. 사진만 남긴 하루는 빈 배열이다.
  authors: { id: number; nickname: string }[];
  record_summary: DiaryRecordSummary;
};

export type DiaryFeedResponse = {
  items: DiaryFeedItem[];
  // null이면 마지막 페이지다. 값은 해석하지 않고 그대로 다음 요청에 넘긴다.
  next_cursor: string | null;
};

/** 작성자 한 사람의 본문. */
export type DiaryEntry = {
  id: number;
  schedule_id: number;
  author: { id: number; nickname: string };
  content: string;
  mood: string | null;
  created_at: string;
  updated_at: string;
};

/** 하루에 남긴 사진 한 장. 작성자별이 아니라 일정에 달린다. */
export type DiaryPhoto = {
  id: number;
  schedule_id: number;
  uploader: { id: number; nickname: string };
  file_url: string;
  thumbnail_url: string | null;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
};

/** 실제 방문 타임라인 항목. */
export type DiaryTimelineItem = {
  id: number;
  schedule_id: number;
  occurred_at: string;
  title: string;
  memo: string | null;
  schedule_place_id: number | null;
  place_name: string | null;
  created_by: { id: number; nickname: string };
  created_at: string;
  updated_at: string;
};

export type DiaryEntryListResponse = { items: DiaryEntry[] };
export type DiaryPhotoListResponse = { photos: DiaryPhoto[] };
export type DiaryTimelineListResponse = { items: DiaryTimelineItem[] };
