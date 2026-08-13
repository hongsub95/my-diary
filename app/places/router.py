"""장소 엔드포인트.

경로가 두 갈래다 (docs/API_SPEC.md 6장).

- `/schedules/{schedule_id}/places` — 일정에 담긴 장소. 인증과 스페이스 멤버십이 필요하다.
- `/places/search` — 지도 검색. 일정과 무관하지만 로그인은 필요하다
  (공급자 쿼터를 익명 호출로 소모당하지 않기 위해서).

일정 장소의 접근 권한은 `ScheduleMemberContext`가 라우터 진입 전에 끝낸다. 볼 수 없는
일정이면 장소 단계까지 오지 못하고 404가 나간다.
"""

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.auth.dependencies import CurrentUser, DbSession
from app.places import service
from app.places.schemas import (
    PlaceSearchResponse,
    SchedulePlaceCreateRequest,
    SchedulePlaceListResponse,
    SchedulePlaceReorderRequest,
    SchedulePlaceResponse,
    SchedulePlaceUpdateRequest,
)
from app.schedules.dependencies import ScheduleMemberContext

schedule_places_router = APIRouter(prefix="/schedules/{schedule_id}/places", tags=["places"])
places_router = APIRouter(prefix="/places", tags=["places"])


@schedule_places_router.get(
    "",
    response_model=SchedulePlaceListResponse,
    summary="일정의 장소 목록",
    description="일정에 담긴 장소를 방문 순서(sort_order 오름차순)대로 돌려준다.",
)
def list_places(context: ScheduleMemberContext, db: DbSession) -> SchedulePlaceListResponse:
    """일정의 장소 목록 조회. 일정 상세 화면과 지도가 사용한다."""
    return SchedulePlaceListResponse(items=service.list_places(db, context.schedule))


@schedule_places_router.post(
    "",
    response_model=SchedulePlaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="일정에 장소 추가",
    description=(
        "장소를 일정의 **맨 뒤**에 추가한다. `sort_order`는 받지 않으며 순서 조정은 "
        "reorder로만 한다. 검색 결과 객체를 그대로 본문에 넣을 수 있다. "
        "외부 지도에서 온 장소(provider + provider_place_id)는 이미 저장돼 있으면 재사용한다."
    ),
)
def add_place(
    payload: SchedulePlaceCreateRequest,
    context: ScheduleMemberContext,
    db: DbSession,
) -> SchedulePlaceResponse:
    """일정에 장소 추가."""
    schedule_place = service.add_place(
        db,
        context.schedule,
        name=payload.name,
        address=payload.address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        provider=payload.provider,
        provider_place_id=payload.provider_place_id,
        planned_time=payload.planned_time,
        memo=payload.memo,
    )
    return service.to_response(schedule_place)


@schedule_places_router.patch(
    "/reorder",
    response_model=SchedulePlaceListResponse,
    summary="장소 순서 일괄 변경",
    description=(
        "`schedule_place_ids` 배열의 순서가 곧 표시 순서가 된다. "
        "**그 일정의 장소를 빠짐없이 모두** 보내야 한다. 일부만 보내면 422다."
    ),
)
def reorder_places(
    payload: SchedulePlaceReorderRequest,
    context: ScheduleMemberContext,
    db: DbSession,
) -> SchedulePlaceListResponse:
    """장소 순서 일괄 변경. 변경된 전체 목록을 돌려준다."""
    items = service.reorder_places(db, context.schedule, payload.schedule_place_ids)
    return SchedulePlaceListResponse(items=items)


@schedule_places_router.patch(
    "/{schedule_place_id}",
    response_model=SchedulePlaceResponse,
    summary="장소 메모·방문여부 수정",
    description=(
        "보낸 필드만 변경한다. `memo`와 `planned_time`에 null을 보내면 지워진다. "
        "장소 자체(이름·좌표)는 바꿀 수 없다 — 다른 일정도 같은 장소를 참조하기 때문이다."
    ),
)
def update_place(
    schedule_place_id: int,
    payload: SchedulePlaceUpdateRequest,
    context: ScheduleMemberContext,
    db: DbSession,
) -> SchedulePlaceResponse:
    """일정 속 장소 수정."""
    schedule_place = service.get_schedule_place(db, context.schedule, schedule_place_id)
    changes = payload.model_dump(exclude_unset=True)
    updated = service.update_place(db, schedule_place, changes)
    return service.to_response(updated)


@schedule_places_router.delete(
    "/{schedule_place_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="일정에서 장소 제거",
    description=(
        "일정에서 장소를 뺀다. 장소 자체는 지워지지 않는다(다른 일정이 참조할 수 있음). "
        "남은 장소의 순서는 그대로 유지된다."
    ),
)
def remove_place(
    schedule_place_id: int,
    context: ScheduleMemberContext,
    db: DbSession,
) -> None:
    """일정에서 장소 제거."""
    schedule_place = service.get_schedule_place(db, context.schedule, schedule_place_id)
    service.remove_place(db, schedule_place)
    return None


@places_router.get(
    "/search",
    response_model=PlaceSearchResponse,
    summary="장소 검색",
    description=(
        "지도 공급자에서 장소를 찾는다. 결과 객체를 그대로 "
        "`POST /schedules/{schedule_id}/places` 본문에 넣을 수 있다. "
        "**지도 공급자 확정 전까지 `provider: \"mock\"`인 가짜 결과가 나온다.** "
        "응답 구조는 실제 연동 후에도 동일하다."
    ),
)
def search_places(
    current_user: CurrentUser,
    query: Annotated[str, Query(alias="query", min_length=1, max_length=100, description="검색어")],
) -> PlaceSearchResponse:
    """장소 검색.

    로그인을 요구하는 이유: 공급자 쿼터는 유료 자원이라 익명 호출로 소모되면 안 된다.
    """
    return service.search_places(query.strip())
