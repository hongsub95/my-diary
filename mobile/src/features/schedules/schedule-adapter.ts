import type { Schedule, SchedulePlace } from '@/shared/api/types';
import { seoulDateKey } from '@/shared/utils/date';

// API 응답을 화면이 쓰는 형태로 바꾸는 자리.
//
// 화면 컴포넌트가 API 응답 구조에 직접 의존하지 않게 한다는 결정(docs/DEVELOPMENT_BRIEF.md
// 7절)에 따른 것이다. 웹의 frontend/src/shared/api/scheduleAdapter.js와 같은 모양으로
// 맞춰 두었다. 두 클라이언트가 같은 값을 다르게 계산하기 시작하면 화면이 어긋난다.

/** 화면이 쓰는 장소 하나. 두 층으로 오는 응답을 평평하게 편 것이다. */
export type SchedulePlaceView = {
  /** 이 일정에 담긴 장소의 id. 수정·삭제·순서변경에 쓰는 값이다 */
  id: number;
  /** 장소 자체의 id. 같은 장소를 여러 일정이 공유한다 */
  placeId: number;
  name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  sortOrder: number;
  plannedTime: string | null;
  memo: string | null;
  visited: boolean;
};

/** 화면이 쓰는 일정 하나. */
export type ScheduleView = {
  id: number;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  status: Schedule['status'];
  space_name: string;
  /** 날짜별로 묶을 때 쓰는 한국 기준 날짜 키 */
  dateKey: string;
  place_count: number;
  has_diary: boolean;
  places: SchedulePlaceView[];
};

function toPlaceView(item: SchedulePlace): SchedulePlaceView {
  return {
    id: item.id,
    placeId: item.place.id,
    name: item.place.name,
    address: item.place.address,
    latitude: item.place.latitude,
    longitude: item.place.longitude,
    sortOrder: item.sort_order,
    plannedTime: item.planned_time,
    memo: item.memo,
    visited: item.visited,
  };
}

/**
 * 일정 응답 하나를 화면용으로 바꾼다.
 *
 * dateKey를 여기서 만드는 이유: 화면마다 start_at 앞 10자를 자르면 UTC 날짜가 나와서,
 * 밤 9시 이후(KST) 일정이 하루 뒤 칸에 찍힌다.
 */
export function toScheduleView(schedule: Schedule): ScheduleView {
  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    start_at: schedule.start_at,
    end_at: schedule.end_at,
    status: schedule.status,
    space_name: schedule.space_name,
    dateKey: seoulDateKey(schedule.start_at),
    // 장소 개수는 include 여부와 상관없이 항상 온다. 장소를 요청하지 않은 화면도
    // 이 값으로는 정확한 개수를 보여줄 수 있다.
    place_count: schedule.place_count,
    has_diary: schedule.has_diary,
    // null(요청 안 함)은 화면에서 순회할 수 있게 빈 배열로 바꾼다. 실제 장소 유무는
    // place_count로 판단한다.
    places: (schedule.places ?? []).map(toPlaceView),
  };
}

/** 상세 응답과 장소 목록을 합쳐 화면용 일정으로 만든다. */
export function toScheduleDetailView(
  schedule: Schedule,
  placeItems: SchedulePlace[],
): ScheduleView {
  return { ...toScheduleView(schedule), places: placeItems.map(toPlaceView) };
}
