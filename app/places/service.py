"""장소 비즈니스 로직.

접근 권한은 이 모듈이 판단하지 않는다. 라우터가 `ScheduleMemberContext`로 "그 일정을
볼 수 있는가"를 이미 확인한 뒤에 호출한다. 여기서는 일정 안에서의 규칙만 다룬다.
"""

from datetime import time
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.places import providers
from app.places.errors import (
    InvalidReorderError,
    PlaceSearchUnavailableError,
    SchedulePlaceNotFoundError,
)
from app.places.models import Place, SchedulePlace
from app.places.schemas import (
    PROVIDER_MANUAL,
    PlaceResponse,
    PlaceSearchResponse,
    SchedulePlaceResponse,
)
from app.schedules.models import Schedule

settings = get_settings()

# 검색 결과 최대 개수. 화면이 한 번에 보여줄 수 있는 양을 넘기면 스크롤만 길어진다.
SEARCH_LIMIT = 15


def to_response(schedule_place: SchedulePlace) -> SchedulePlaceResponse:
    """SchedulePlace를 API 응답 형태로 바꾼다.

    :param schedule_place: place가 이미 로드된 상태여야 한다
    """
    return SchedulePlaceResponse(
        id=schedule_place.id,
        place=PlaceResponse.model_validate(schedule_place.place),
        sort_order=schedule_place.sort_order,
        planned_time=schedule_place.planned_time,
        memo=schedule_place.memo,
        visited=schedule_place.visited,
    )


def list_places(db: Session, schedule: Schedule) -> list[SchedulePlaceResponse]:
    """일정의 장소를 방문 순서대로 돌려준다."""
    rows = db.scalars(
        select(SchedulePlace)
        .options(joinedload(SchedulePlace.place))
        .where(SchedulePlace.schedule_id == schedule.id)
        # sort_order가 같으면(동시에 추가된 경우) id 순으로 안정적으로 정렬한다.
        .order_by(SchedulePlace.sort_order, SchedulePlace.id)
    ).all()
    return [to_response(row) for row in rows]


def get_schedule_place(db: Session, schedule: Schedule, schedule_place_id: int) -> SchedulePlace:
    """일정에 속한 장소 하나를 찾는다.

    :raises SchedulePlaceNotFoundError: 없거나 **다른 일정**의 장소일 때

    schedule_id 조건을 반드시 함께 건다. id만으로 찾으면 남의 일정에 달린 장소를
    수정·삭제할 수 있게 된다.
    """
    schedule_place = db.scalar(
        select(SchedulePlace)
        .options(joinedload(SchedulePlace.place))
        .where(
            SchedulePlace.id == schedule_place_id,
            SchedulePlace.schedule_id == schedule.id,
        )
    )
    if schedule_place is None:
        raise SchedulePlaceNotFoundError()
    return schedule_place


def _get_or_create_place(
    db: Session,
    name: str,
    address: str | None,
    latitude: Decimal | None,
    longitude: Decimal | None,
    provider: str,
    provider_place_id: str | None,
) -> Place:
    """외부 지도에서 온 장소는 재사용하고, 직접 입력한 장소는 새로 만든다.

    :return: 저장된 Place (아직 commit 전)

    같은 카페를 여러 사용자가 담아도 nl_places에는 한 행만 남긴다. 중복 저장하면
    나중에 "이 장소를 방문한 기록 모아보기" 같은 기능을 만들 수 없다
    (app/places/models.py의 uq_places_provider_place).

    manual 장소는 재사용하지 않는다. 이름이 같아도 사용자가 뜻한 곳이 다를 수 있고,
    한 사람이 고친 이름이 남의 기록까지 바꿔버린다.
    """
    if provider != PROVIDER_MANUAL and provider_place_id is not None:
        existing = db.scalar(
            select(Place).where(
                Place.provider == provider,
                Place.provider_place_id == provider_place_id,
            )
        )
        if existing is not None:
            return existing

    place = Place(
        name=name,
        address=address,
        latitude=latitude,
        longitude=longitude,
        provider=provider,
        provider_place_id=provider_place_id if provider != PROVIDER_MANUAL else None,
    )
    db.add(place)
    db.flush()
    return place


def add_place(
    db: Session,
    schedule: Schedule,
    name: str,
    address: str | None,
    latitude: Decimal | None,
    longitude: Decimal | None,
    provider: str,
    provider_place_id: str | None,
    planned_time: time | None,
    memo: str | None,
) -> SchedulePlace:
    """일정 맨 뒤에 장소를 추가한다.

    :return: 생성된 SchedulePlace

    sort_order를 요청으로 받지 않고 항상 맨 뒤에 붙인다. 중간에 끼워 넣는 요청을
    허용하면 뒤 항목들의 순서를 같이 밀어야 하고, 두 사람이 동시에 넣을 때 순서가
    꼬인다. 순서 조정은 reorder 하나로만 한다.
    """
    place = _get_or_create_place(
        db, name, address, latitude, longitude, provider, provider_place_id
    )

    # 현재 최대 sort_order + 1. 비어 있으면 0부터 시작한다.
    last_order = db.scalar(
        select(func.max(SchedulePlace.sort_order)).where(SchedulePlace.schedule_id == schedule.id)
    )
    next_order = 0 if last_order is None else last_order + 1

    schedule_place = SchedulePlace(
        schedule_id=schedule.id,
        place_id=place.id,
        sort_order=next_order,
        planned_time=planned_time,
        memo=memo,
    )
    db.add(schedule_place)
    db.commit()
    db.refresh(schedule_place)
    return schedule_place


def update_place(db: Session, schedule_place: SchedulePlace, changes: dict) -> SchedulePlace:
    """일정 속 장소의 메모·예정시각·방문여부를 수정한다.

    :param changes: 실제로 요청 본문에 담겨 온 필드만 들어 있는 dict.
        memo와 planned_time은 null을 보내 지울 수 있어야 하므로 "안 보냄"과 구분한다.
    """
    for field, value in changes.items():
        setattr(schedule_place, field, value)
    db.commit()
    db.refresh(schedule_place)
    return schedule_place


def remove_place(db: Session, schedule_place: SchedulePlace) -> None:
    """일정에서 장소를 뺀다.

    Place 자체는 지우지 않는다. 다른 일정이 같은 장소를 참조하고 있을 수 있다.
    빠진 자리의 sort_order도 다시 매기지 않는다. 정렬은 값의 크기 순서로만 하므로
    번호가 비어도 표시 순서는 그대로다.
    """
    db.delete(schedule_place)
    db.commit()


def reorder_places(db: Session, schedule: Schedule, ordered_ids: list[int]) -> list[SchedulePlaceResponse]:
    """장소 순서를 일괄 변경한다. 배열 순서가 곧 표시 순서다.

    :param ordered_ids: 그 일정의 schedule_place id **전체**를 원하는 순서로 나열한 것
    :raises InvalidReorderError: 목록이 현재 장소 전체와 일치하지 않을 때

    부분 목록을 거절하는 이유: 빠진 장소를 앞에 둘지 뒤에 둘지 정할 근거가 없고,
    두 사람이 동시에 순서를 바꿀 때 결과를 예측할 수 없게 된다.
    """
    current = db.scalars(
        select(SchedulePlace).where(SchedulePlace.schedule_id == schedule.id)
    ).all()
    current_ids = {row.id for row in current}

    if len(ordered_ids) != len(set(ordered_ids)):
        raise InvalidReorderError("같은 장소가 두 번 들어 있습니다.")

    requested_ids = set(ordered_ids)
    if requested_ids != current_ids:
        # 무엇이 잘못됐는지 알려준다. 목록이 어긋나는 흔한 원인은 다른 화면에서
        # 이미 장소를 지웠거나 추가한 경우다.
        missing = current_ids - requested_ids
        unknown = requested_ids - current_ids
        if unknown:
            raise InvalidReorderError("이 일정에 없는 장소가 포함되어 있습니다.")
        raise InvalidReorderError(
            f"일정의 장소를 모두 포함해야 합니다. {len(missing)}개가 빠졌습니다."
        )

    by_id = {row.id: row for row in current}
    for position, schedule_place_id in enumerate(ordered_ids):
        by_id[schedule_place_id].sort_order = position

    db.commit()
    return list_places(db, schedule)


def search_places(query: str) -> PlaceSearchResponse:
    """지도 공급자에서 장소를 검색한다.

    :param query: 검색어
    :raises PlaceSearchUnavailableError: 공급자 설정이 잘못됐거나 호출에 실패했을 때

    공급자의 원본 오류를 그대로 올리지 않는다. 키나 쿼터 같은 내부 사정이 노출되고,
    공급자를 바꾸면 클라이언트가 함께 깨진다.
    """
    try:
        provider = providers.get_provider(settings.place_search_provider)
        items = provider.search(query, SEARCH_LIMIT)
    except ValueError as error:
        # 설정 오타나 미구현 공급자. 서버 로그에는 원인이 남고 클라이언트는 공통 문구를 받는다.
        raise PlaceSearchUnavailableError() from error

    return PlaceSearchResponse(items=items, provider=provider.name)
