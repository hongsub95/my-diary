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
};
export type CoursePlace = {
  kind: 'anchor' | 'recommended';
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
