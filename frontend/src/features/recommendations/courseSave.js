export class CourseSaveError extends Error {}

export function insertBeforeAnchor(items, addedIds, anchorId) {
  const ids = items.map(item => item.id)
  if (!ids.includes(anchorId) || addedIds.some(id => !ids.includes(id))) {
    throw new CourseSaveError('기준 장소나 담은 장소가 변경됐어요. 하루로 돌아가 장소를 확인해 주세요.')
  }
  const remaining = ids.filter(id => !addedIds.includes(id))
  const index = remaining.indexOf(anchorId)
  return [...remaining.slice(0, index), ...addedIds, ...remaining.slice(index)]
}

function addedPlaceIds(items, places, previousIds) {
  const available = items.filter(item => !previousIds.includes(item.id)).sort((a, b) => b.id - a.id)
  return places.map(place => {
    const index = available.findIndex(item => item.place.provider === place.provider &&
      item.place.provider_place_id === place.provider_place_id && (place.provider_place_id != null || item.place.name === place.name))
    if (index < 0) throw new CourseSaveError('담은 장소를 확인하지 못했어요. 하루로 돌아가 장소를 확인해 주세요.')
    return available.splice(index, 1)[0].id
  })
}

// 추가와 재정렬은 별도 요청이다. 추가가 끝난 뒤에는 재시도해도 재정렬만 실행한다.
export function createCourseSaver({ listPlaces, addPlaces, reorderPlaces, onPendingChange }) {
  let pending = null
  return async (places, anchor) => {
    let items
    if (!pending) {
      if (!places.length) throw new CourseSaveError('일정에 담을 장소를 하나 이상 선택해 주세요.')
      const before = anchor?.position === 'before'
      const previous = before ? await listPlaces() : []
      if (before && !previous.some(item => item.id === anchor.schedule_place_id)) {
        throw new CourseSaveError('기준 장소가 변경됐어요. 조건을 다시 선택해 주세요.')
      }
      items = await addPlaces(places)
      if (!before) return
      pending = { items, places, previousIds: previous.map(item => item.id), anchorId: anchor.schedule_place_id }
      onPendingChange(true)
    }
    const addedIds = addedPlaceIds(pending.items, pending.places, pending.previousIds)
    // 실패 후 재시도에는 최신 전체 목록을 사용하여 다른 사용자의 장소도 보존한다.
    items = items ?? await listPlaces()
    const order = insertBeforeAnchor(items, addedIds, pending.anchorId)
    try { await reorderPlaces(order) }
    catch { throw new CourseSaveError('장소는 담았지만 순서를 맞추지 못했어요. 아래 버튼으로 순서만 다시 맞춰 주세요.') }
    pending = null
    onPendingChange(false)
  }
}
