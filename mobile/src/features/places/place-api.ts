import { apiClient } from '@/shared/api/client';

// 장소 검색. 명세는 docs/API_SPEC.md 6.7절이다.
//
// 장소 추가·삭제는 schedule-api.ts에 있다. 장소는 일정에 딸린 리소스라 그쪽에 두는 편이
// 경로(/schedules/{id}/places)와도 맞는다. 여기는 일정과 무관한 검색만 담당한다.

/** 지도 공급자가 돌려주는 검색 결과 하나. 그대로 장소 추가 요청에 넣을 수 있다. */
export type PlaceSearchResult = {
  name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  provider: string;
  provider_place_id: string | null;
  category: string | null;
  phone: string | null;
};

export type PlaceSearchResponse = {
  items: PlaceSearchResult[];
  /** 'mock'이면 아직 실제 지도 공급자가 붙기 전이라는 뜻이다 */
  provider: string;
};

/** 키워드로 장소를 찾는다. */
export async function searchPlaces(query: string): Promise<PlaceSearchResponse> {
  const response = await apiClient.get<PlaceSearchResponse>('/places/search', {
    params: { query },
  });
  return response.data;
}
