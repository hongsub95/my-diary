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
};
