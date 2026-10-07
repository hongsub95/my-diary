import { apiClient } from '@/shared/api/client';
import { formatDistance } from '@/shared/utils/distance';
import type { SchedulePlaceListResponse } from '@/shared/api/types';
import type { BatchPlace } from './course-save';

export type Choice = { code: string; label: string };
export type RecommendationOptions = {
  categories: (Choice & { subcategories: Choice[] })[];
  radius_options_m: number[];
  default_radius_m: number;
  party_sizes: Choice[];
  default_item_count: number;
  max_item_count: number;
  basis: 'straight_line';
};
export type CourseRequest = {
  anchor?: { schedule_place_id: number; position: 'before' | 'after' };
  area_query?: string;
  radius_m: number;
  party_size: string;
  items: { category: string; subcategory: string }[];
  /** "다시 추천" 때만 보낸다. 지금까지 보여준 추천 장소의 place_key */
  exclude_place_keys?: string[];
};
export type CoursePlace = {
  kind: 'anchor' | 'recommended';
  /** 추천 장소에만 있다. 다시 추천 때 그대로 돌려보낸다. 내용을 해석하지 않는다 */
  place_key?: string | null;
  schedule_place_id: number | null;
  name: string;
  address: string | null;
  latitude: string;
  longitude: string;
  provider: string;
  provider_place_id: string | null;
  category: string | null;
  phone: string | null;
  reason: string | null;
  warnings: string[];
};
export type CourseCandidate = {
  rank: number;
  total_distance_m: number;
  places: CoursePlace[];
  legs: { from_index: number; to_index: number; distance_m: number }[];
};
export type Relaxation = { code: 'WIDEN_RADIUS' | 'USE_ANY_SUBCATEGORY'; item_index: number | null; radius_m: number | null };
export type CourseResult = {
  center: { label: string; latitude: string; longitude: string };
  candidates: CourseCandidate[];
  empty_item_indexes: number[];
  /** 다시 추천에서 새 후보가 바닥나 이미 보여준 장소를 다시 쓴 항목 */
  exhausted_item_indexes?: number[];
  relaxation_suggestions: Relaxation[];
  basis: 'straight_line';
};

export function formatCourseLeg(distance: number | undefined) {
  return distance == null ? '거리 확인 필요' : `직선거리 ${formatDistance(distance)}`;
}

export function recommendedIndexes(candidate: CourseCandidate) {
  return candidate.places.flatMap((place, index) => place.kind === 'recommended' ? [index] : []);
}
export function toBatchPlaces(candidate: CourseCandidate, selectedIndexes: number[]): BatchPlace[] {
  return candidate.places.filter((place, index) => place.kind === 'recommended' && selectedIndexes.includes(index)).map(place => ({
    name: place.name, address: place.address, latitude: place.latitude,
    longitude: place.longitude, provider: place.provider, provider_place_id: place.provider_place_id,
  }));
}

export const warningLabels: Record<string, string> = {
  BUSINESS_HOURS_UNVERIFIED: '영업시간 확인 필요',
  PARTY_SIZE_UNVERIFIED: '수용 인원 확인 필요',
};

export async function getRecommendationOptions(): Promise<RecommendationOptions> {
  return (await apiClient.get<RecommendationOptions>('/recommendation-options')).data;
}

export async function previewCourse(scheduleId: number, conditions: CourseRequest): Promise<CourseResult> {
  return (await apiClient.post<CourseResult>(`/schedules/${scheduleId}/course-recommendations/preview`, conditions)).data;
}

export async function addRecommendedCourse(scheduleId: number, places: BatchPlace[]) {
  // 기준 장소를 빼고 저장 필드만 보낸다. 한 트랜잭션으로 전부 추가하거나 전부 실패한다.
  return (await apiClient.post<SchedulePlaceListResponse>(`/schedules/${scheduleId}/places/batch`, { places })).data.items;
}

export function relaxConditions(request: CourseRequest, suggestion: Relaxation): CourseRequest {
  if (suggestion.code === 'WIDEN_RADIUS' && suggestion.radius_m != null) return { ...request, radius_m: suggestion.radius_m };
  if (suggestion.code === 'USE_ANY_SUBCATEGORY') return {
    ...request,
    items: request.items.map((item, index) => index === suggestion.item_index ? { ...item, subcategory: 'any' } : item),
  };
  return request;
}

// 서버가 받는 제외 목록 상한(app/recommendations/schemas.py MAX_EXCLUDED_PLACES). 넘기면 422다.
const MAX_EXCLUDED_PLACES = 120;

/**
 * 응답의 모든 코스에서 추천 장소의 place_key를 모은다. "다시 추천" 때 빼 달라고 보낼 값이다.
 * 웹의 recommendationModel.js와 같은 규칙이다.
 */
export function shownPlaceKeys(result: CourseResult): string[] {
  const keys = result.candidates.flatMap(candidate => candidate.places
    .filter(place => place.kind === 'recommended' && place.place_key)
    .map(place => place.place_key as string));
  return [...new Set(keys)];
}

/**
 * 지금까지 본 값에 새로 본 값을 더한다. 상한을 넘으면 오래 본 것부터 버린다 — 오래전에 본
 * 장소가 다시 나오는 편이, 요청이 거절돼 다시 추천이 아예 안 되는 것보다 낫다.
 */
export function mergeShownKeys(previous: string[], next: string[]): string[] {
  return [...new Set([...previous, ...next])].slice(-MAX_EXCLUDED_PLACES);
}

/**
 * 다시 추천 결과를 알릴 문구. 알릴 것이 없으면 null.
 *
 * 새 코스가 없을 때는 "조건에 맞는 곳이 없다"와 다르다 — 장소는 있지만 이미 다 보여준 것이다.
 */
export function rerollNotice(result: CourseResult, conditions: CourseRequest, categories: Choice[]): string | null {
  if (!result.candidates.length) return '더 보여드릴 새 코스가 없어요. 반경을 넓히거나 조건을 바꿔 찾아보세요.';
  const exhausted = result.exhausted_item_indexes ?? [];
  if (!exhausted.length) return null;
  const labels = exhausted.map(index => {
    const label = categories.find(category => category.code === conditions.items[index]?.category)?.label ?? '항목';
    return `${index + 1}번째 ${label}`;
  });
  return `${labels.join(', ')}: 더 보여드릴 곳이 없어 같은 곳을 다시 넣었어요.`;
}
