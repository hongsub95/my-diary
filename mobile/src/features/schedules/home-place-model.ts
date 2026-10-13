import type { SchedulePlaceView, ScheduleView } from './schedule-adapter';

/** 사용자 순서를 유지한다. 좌표 없는 장소도 순서와 방문 진행에 포함한다. */
export function orderedHomePlaces(schedule: ScheduleView): SchedulePlaceView[] {
  return [...schedule.places].sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
}

export function homePlaceFocus(schedule: ScheduleView, selectedPlaceId?: number) {
  const places = orderedHomePlaces(schedule);
  const visitedCount = places.filter(place => place.visited).length;
  const selected = places.find(place => place.id === selectedPlaceId);
  const planning = schedule.experience_phase === 'upcoming' || schedule.experience_phase === 'today';
  const next = planning ? places.find(place => !place.visited) : undefined;
  const place = selected ?? next ?? (planning ? places.at(-1) : places.find(item => item.visited) ?? places[0]);
  const label = selected ? '선택한 장소' : next ? '다음 장소' : planning && place ? '모든 장소 방문 완료' : '하루의 장소';

  return { places, place, label, visitedCount, ordinal: place ? places.indexOf(place) + 1 : 0 };
}
