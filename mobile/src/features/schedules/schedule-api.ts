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
  date: string;
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
  const toUtcIso = (time: string) => new Date(`${input.date}T${time}:00+09:00`).toISOString();

  const response = await apiClient.post<Schedule>(`/spaces/${input.spaceId}/schedules`, {
    title: input.title,
    description: input.description || null,
    start_at: toUtcIso(input.startTime),
    end_at: toUtcIso(input.endTime),
  });
  return response.data;
}

export type AddSchedulePlaceInput = {
  name: string;
  plannedTime?: string | null;
  memo?: string | null;
};

/** 장소 검색 연동 전에도 사용할 수 있는 수동 장소 추가 경계. */
export async function addSchedulePlace(
  scheduleId: number,
  input: AddSchedulePlaceInput,
): Promise<SchedulePlace> {
  const response = await apiClient.post<SchedulePlace>(`/schedules/${scheduleId}/places`, {
    name: input.name,
    address: null,
    latitude: null,
    longitude: null,
    provider: 'manual',
    provider_place_id: null,
    planned_time: input.plannedTime ? `${input.plannedTime}:00` : null,
    memo: input.memo || null,
  });
  return response.data;
}
