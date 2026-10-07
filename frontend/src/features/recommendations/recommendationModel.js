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

// 서버가 받는 제외 목록 상한(app/recommendations/schemas.py MAX_EXCLUDED_PLACES). 넘기면 422다.
const MAX_EXCLUDED_PLACES = 120

/**
 * 응답의 모든 코스에서 추천 장소의 place_key를 모은다. "다시 추천" 때 빼 달라고 보낼 값이다.
 *
 * @param {object} result 코스 추천 미리보기 응답
 * @returns {string[]} 중복 없는 place_key. 기준 장소는 값이 없어 빠진다
 */
export function shownPlaceKeys(result) {
  const keys = result.candidates.flatMap(candidate => candidate.places
    .filter(place => place.kind === 'recommended' && place.place_key)
    .map(place => place.place_key))
  return [...new Set(keys)]
}

/**
 * 지금까지 본 값에 새로 본 값을 더한다.
 *
 * 상한을 넘으면 **오래 본 것부터** 버린다. 오래전에 본 장소가 다시 나오는 편이, 요청이
 * 거절돼 다시 추천이 아예 안 되는 것보다 낫다.
 */
export function mergeShownKeys(previous, next) {
  return [...new Set([...previous, ...next])].slice(-MAX_EXCLUDED_PLACES)
}

/**
 * 다시 추천 결과를 알릴 문구. 알릴 것이 없으면 null.
 *
 * @param {object} result 다시 추천 응답
 * @param {object} conditions 요청 조건 (항목의 분류 이름을 찾는 데 쓴다)
 * @param {Array} categories 폼 옵션의 대분류 목록
 *
 * 새 코스가 없을 때와, 일부 항목만 바닥나 같은 곳을 다시 넣었을 때를 나눠 말한다. 앞의 것은
 * "조건에 맞는 곳이 없다"와 다르다 — 장소는 있지만 이미 다 보여준 것이다.
 */
export function rerollNotice(result, conditions, categories) {
  if (!result.candidates.length) return '더 보여드릴 새 코스가 없어요. 반경을 넓히거나 조건을 바꿔 찾아보세요.'
  const exhausted = result.exhausted_item_indexes ?? []
  if (!exhausted.length) return null
  const labels = exhausted.map(index => {
    const label = categories.find(category => category.code === conditions.items[index]?.category)?.label ?? '항목'
    return `${index + 1}번째 ${label}`
  })
  return `${labels.join(', ')}: 더 보여드릴 곳이 없어 같은 곳을 다시 넣었어요.`
}
