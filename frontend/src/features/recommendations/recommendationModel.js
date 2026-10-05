import { formatDistance } from '../../shared/utils/distance'

export const WARNING_LABELS = {
  BUSINESS_HOURS_UNVERIFIED: '영업시간 확인 필요',
  PARTY_SIZE_UNVERIFIED: '수용 인원 확인 필요',
}

export function formatCourseLeg(distance) {
  return distance == null ? '거리 확인 필요' : `직선거리 ${formatDistance(distance)}`
}

// 기준 장소는 이미 저장되어 있다. 추가 API에는 추천 장소의 저장 필드만 보낸다.
export function recommendedIndexes(candidate) {
  return candidate.places.flatMap((place, index) => place.kind === 'recommended' ? [index] : [])
}

export function toBatchPlaces(candidate, selectedIndexes = recommendedIndexes(candidate)) {
  return candidate.places.filter((place, index) => place.kind === 'recommended' && selectedIndexes.includes(index)).map(place => ({
    name: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    provider: place.provider,
    provider_place_id: place.provider_place_id,
  }))
}

export function recommendationReturnPath(scheduleId, source) {
  return source === 'plan' ? `/schedules/${scheduleId}/plan` : `/schedules/${scheduleId}`
}

export function relaxConditions(request, suggestion) {
  if (suggestion.code === 'WIDEN_RADIUS') return { ...request, radius_m: suggestion.radius_m }
  if (suggestion.code === 'USE_ANY_SUBCATEGORY') return {
    ...request,
    items: request.items.map((item, index) => index === suggestion.item_index ? { ...item, subcategory: 'any' } : item),
  }
  return request
}
