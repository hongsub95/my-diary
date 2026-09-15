import { apiClient } from '@/shared/api/client';
import type {
  Schedule,
  ScheduleListResponse,
  SchedulePlace,
  SchedulePlaceListResponse,
} from '@/shared/api/types';

// 일정·장소 API 호출만 담당한다. 응답을 화면 형태로 바꾸는 일은 schedule-adapter.ts가 한다.
// 명세는 docs/API_SPEC.md 5장(일정)과 6장(장소)이다.

export type ListSchedulesParams = {
  /** 스페이스 공개 UUID. /auth/me의 default_space_id를 그대로 쓴다 */
  spaceId: string;
  /** 조회 시작일 YYYY-MM-DD. 생략하면 서버가 이번 달로 잡는다 */
  from?: string;
  /** 조회 종료일 YYYY-MM-DD */
  to?: string;
  /** 장소까지 함께 받을지. 지도나 장소 이름을 쓰는 화면만 켠다 */
  includePlaces?: boolean;
};

/**
 * 기간별 일정 목록을 조회한다.
 *
 * from/to는 날짜만 보낸다. 한국 시간 기준 하루로 해석하는 일은 서버가 한다(API_SPEC 5.1).
 */
export async function listSchedules({
  spaceId,
  from,
  to,
  includePlaces = false,
}: ListSchedulesParams): Promise<Schedule[]> {
  const response = await apiClient.get<ScheduleListResponse>(`/spaces/${spaceId}/schedules`, {
    params: {
      from,
      to,
      ...(includePlaces ? { include: 'places' } : {}),
    },
  });
  return response.data.items;
}

/** 일정 상세. 상세 응답에는 장소가 담기지 않는다(API_SPEC 5.2). */
export async function getSchedule(scheduleId: number): Promise<Schedule> {
  const response = await apiClient.get<Schedule>(`/schedules/${scheduleId}`);
  return response.data;
}

/** 일정의 장소를 방문 순서대로 조회한다. */
export async function listSchedulePlaces(scheduleId: number): Promise<SchedulePlace[]> {
  const response = await apiClient.get<SchedulePlaceListResponse>(`/schedules/${scheduleId}/places`);
  return response.data.items;
}

export type CreateScheduleInput = {
  spaceId: string;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
};

/**
 * 일정을 만든다.
 *
 * 화면에서 고른 날짜·시각은 한국 시간이고 서버는 UTC로 저장한다(API_SPEC 2.4).
 * 기기 시간대에 기대지 않고 +09:00을 붙여 변환해야, 해외에 있거나 기기 시간대가
 * 어긋난 사용자도 의도한 시각에 일정이 잡힌다.
 */
export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
  const toUtcIso = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`).toISOString();

  const response = await apiClient.post<Schedule>(`/spaces/${input.spaceId}/schedules`, {
    title: input.title,
    description: input.description || null,
    start_at: toUtcIso(input.startDate, input.startTime),
    end_at: toUtcIso(input.endDate, input.endTime),
  });
  return response.data;
}

export type AddSchedulePlaceInput = {
  address_detail?: string | null;
  name: string;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  /** 검색 결과에서 왔으면 그 공급자 이름. 직접 입력한 장소는 manual이다 */
  provider?: string;
  provider_place_id?: string | null;
  plannedTime?: string | null;
  memo?: string | null;
};

/**
 * 일정에 장소를 추가한다. 항상 맨 뒤에 붙는다.
 *
 * 검색 결과에서 온 값이면 provider와 provider_place_id를 함께 보내야 서버가 같은 장소를
 * 재사용한다. 좌표를 빠뜨리면 나중에 지도에 찍을 수 없으므로 결과 항목을 통째로 넘긴다.
 */
export async function addSchedulePlace(
  scheduleId: number,
  input: AddSchedulePlaceInput,
): Promise<SchedulePlace> {
  const response = await apiClient.post<SchedulePlace>(`/schedules/${scheduleId}/places`, {
    name: input.name,
    address: input.address ?? null,
    address_detail: input.address_detail ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    provider: input.provider ?? 'manual',
    provider_place_id: input.provider_place_id ?? null,
    planned_time: input.plannedTime ? `${input.plannedTime}:00` : null,
    memo: input.memo || null,
  });
  return response.data;
}

/**
 * 하루를 완료 처리한다.
 *
 * 같은 요청을 두 번 보내도 결과가 같고, 완료 시각은 처음 값을 유지한다. 종료 시각이
 * 지났다는 이유만으로 서버가 알아서 완료하지는 않는다(docs/API_SPEC.md 5.5절).
 */
export async function completeSchedule(scheduleId: number): Promise<Schedule> {
  const response = await apiClient.post<Schedule>(`/schedules/${scheduleId}/complete`);
  return response.data;
}

/**
 * 일정 속 장소의 방문 여부를 바꾼다.
 *
 * @param schedulePlaceId 바꿀 항목의 id. 장소 자체의 id가 아니다
 *
 * 장소 자체(이름·좌표)는 여기서 바꾸지 않는다. 같은 Place를 다른 일정도 참조하고 있어서
 * 한 일정에서 고치면 남의 기록까지 바뀐다(API_SPEC 6.5절).
 */
export async function setPlaceVisited(
  scheduleId: number,
  schedulePlaceId: number,
  visited: boolean,
): Promise<SchedulePlace> {
  const response = await apiClient.patch<SchedulePlace>(
    `/schedules/${scheduleId}/places/${schedulePlaceId}`,
    { visited },
  );
  return response.data;
}

/**
 * 일정에서 장소를 뺀다.
 *
 * @param schedulePlaceId 뺄 항목의 id. 장소 자체의 id가 아니다(API_SPEC 6.1절)
 */
export async function removeSchedulePlace(
  scheduleId: number,
  schedulePlaceId: number,
): Promise<void> {
  await apiClient.delete(`/schedules/${scheduleId}/places/${schedulePlaceId}`);
}

/**
 * 일정 속 장소 순서를 한 번에 바꾼다.
 *
 * @param schedulePlaceIds 원하는 순서대로 담은 **전체** 목록
 * @returns 바뀐 전체 목록. 다시 조회할 필요가 없다
 *
 * **일부만 보내면 422다.** 하나씩 sort_order를 고치는 방식이 아닌 이유는
 * API_SPEC 6.4절에 있다 — 중간 상태가 꼬이고, 빠진 장소를 앞뒤 어디에 둘지
 * 정할 근거가 없다.
 */
export async function reorderSchedulePlaces(
  scheduleId: number,
  schedulePlaceIds: number[],
): Promise<SchedulePlace[]> {
  const response = await apiClient.patch<SchedulePlaceListResponse>(
    `/schedules/${scheduleId}/places/reorder`,
    { schedule_place_ids: schedulePlaceIds },
  );
  return response.data.items;
}

/** 순서 최적화 제안. 일정은 바뀌지 않는다. */
export type OptimizationPreview = {
  current: { schedule_place_ids: number[]; total_distance_m: number };
  suggested: { schedule_place_ids: number[]; total_distance_m: number };
  /** 줄어드는 직선거리(m). 제안하지 않을 때는 0 */
  saved_distance_m: number;
  /** 제안할 만한가. 100m 미만 차이면 false */
  recommended: boolean;
  /** 계산 근거. 지금은 직선거리뿐이다 */
  basis: 'straight_line';
  /** 좌표가 없어 계산에서 빠진 장소. 제안 목록에는 그대로 들어 있다 */
  skipped_place_ids: number[];
};

/**
 * 담은 장소를 가까운 순으로 다시 배열한 순서를 제안받는다. **일정은 바뀌지 않는다.**
 *
 * 적용하려면 `suggested.schedule_place_ids`를 그대로 `reorderSchedulePlaces`에 넘긴다.
 *
 * **직선거리 기준이다.** 실제 도로·도보 경로가 아니므로 화면에 근거를 함께 밝혀야 한다.
 */
export async function previewPlaceOptimization(
  scheduleId: number,
): Promise<OptimizationPreview> {
  const response = await apiClient.post<OptimizationPreview>(
    `/schedules/${scheduleId}/optimization-preview`,
  );
  return response.data;
}
