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
