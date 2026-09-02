"""수동 방문 타임라인 엔드포인트.

사진과 같은 이유로 경로가 두 갈래다.

- `/schedules/{schedule_id}/diary/timeline` — 추가·목록. 어느 하루인지 경로가 말해준다.
- `/diary-timeline/{item_id}` — 개별 항목 수정·삭제. 항목 id만으로 찾는다.

뒤쪽 경로에는 일정이 드러나지 않아 권한 검사를 여기서 직접 한다. 항목 → 일정 →
스페이스 멤버십 순으로 거슬러 올라가며, 볼 수 없는 항목은 없는 것과 같은 404를 준다.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.auth.dependencies import CurrentUser, DbSession
from app.diaries import timeline_service
from app.diaries.errors import DiaryTimelineItemNotFoundError
from app.diaries.models import DiaryTimelineItem
from app.diaries.schemas import (
    DiaryTimelineCreateRequest,
    DiaryTimelineItemResponse,
    DiaryTimelineListResponse,
    DiaryTimelineUpdateRequest,
)
from app.places.models import SchedulePlace
from app.schedules.dependencies import ScheduleMemberContext
from app.schedules.models import Schedule
from app.spaces.dependencies import get_active_membership
from app.spaces.models import SpaceMember

schedule_timeline_router = APIRouter(
    prefix="/schedules/{schedule_id}/diary", tags=["diary-timeline"]
)
timeline_router = APIRouter(prefix="/diary-timeline", tags=["diary-timeline"])


class TimelineContext:
    """권한 검사를 통과한 요청의 타임라인 항목 묶음."""

    def __init__(self, item: DiaryTimelineItem, membership: SpaceMember) -> None:
        self.item = item
        self.membership = membership


def require_timeline_member(
    item_id: Annotated[int, Path(description="타임라인 항목 id")],
    current_user: CurrentUser,
    db: DbSession,
) -> TimelineContext:
    """항목을 찾고 요청자가 그 일정이 속한 스페이스의 활성 멤버인지 확인한다.

    :raises DiaryTimelineItemNotFoundError: 없거나 볼 수 없을 때 (둘을 구분하지 않는다)
    """
    item = db.scalar(
        select(DiaryTimelineItem)
        .options(
            joinedload(DiaryTimelineItem.schedule).joinedload(Schedule.space),
            joinedload(DiaryTimelineItem.schedule_place).joinedload(SchedulePlace.place),
            joinedload(DiaryTimelineItem.created_by_user),
        )
        .where(DiaryTimelineItem.id == item_id)
    )
    if item is None:
        raise DiaryTimelineItemNotFoundError()

    membership = get_active_membership(db, item.schedule.space, current_user.id)
    if membership is None:
        raise DiaryTimelineItemNotFoundError()

    return TimelineContext(item, membership)


TimelineMemberContext = Annotated[TimelineContext, Depends(require_timeline_member)]


@schedule_timeline_router.post(
    "/timeline",
    response_model=DiaryTimelineItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="타임라인 항목 추가",
    description=(
        "실제로 몇 시에 무엇을 했는지 직접 남긴다. 위치 권한을 요구하지 않는다. "
        "`schedule_place_id`로 일정에 담아둔 장소와 연결할 수 있고, 계획에 없던 곳이나 "
        "장소가 아닌 활동은 `title`만으로 남기면 된다."
    ),
)
def add_timeline_item(
    payload: DiaryTimelineCreateRequest,
    context: ScheduleMemberContext,
    current_user: CurrentUser,
    db: DbSession,
) -> DiaryTimelineItemResponse:
    """타임라인 항목 추가."""
    item = timeline_service.add_item(
        db=db,
        schedule=context.schedule,
        user=current_user,
        occurred_at=payload.occurred_at,
        title=payload.title,
        memo=payload.memo,
        schedule_place_id=payload.schedule_place_id,
    )
    return DiaryTimelineItemResponse.from_item(item)


@schedule_timeline_router.get(
    "/timeline",
    response_model=DiaryTimelineListResponse,
    summary="타임라인 조회",
    description=(
        "하루의 방문 타임라인을 시간순으로 돌려준다. 작성자 구분 없이 공용이며, "
        "같은 시각의 항목은 입력한 순서를 유지한다."
    ),
)
def list_timeline(context: ScheduleMemberContext, db: DbSession) -> DiaryTimelineListResponse:
    """타임라인 조회. 완료 상세 화면이 사용한다."""
    items = timeline_service.list_items(db, context.schedule)
    return DiaryTimelineListResponse(
        items=[DiaryTimelineItemResponse.from_item(item) for item in items]
    )


@timeline_router.patch(
    "/{item_id}",
    response_model=DiaryTimelineItemResponse,
    summary="타임라인 항목 수정",
    description=(
        "보낸 필드만 바뀐다. `memo`와 `schedule_place_id`는 null을 보내 지울 수 있다. "
        "작성자와 스페이스 owner만 고칠 수 있다."
    ),
)
def update_timeline_item(
    payload: DiaryTimelineUpdateRequest,
    context: TimelineMemberContext,
    current_user: CurrentUser,
    db: DbSession,
) -> DiaryTimelineItemResponse:
    """타임라인 항목 수정."""
    timeline_service.ensure_can_edit(context.item, context.membership, current_user)
    # 보낸 필드만 추린다. null로 지우려는 요청과 아예 안 보낸 요청을 구분해야 한다.
    changes = payload.model_dump(exclude_unset=True)
    item = timeline_service.update_item(db, context.item, changes)
    return DiaryTimelineItemResponse.from_item(item)


@timeline_router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="타임라인 항목 삭제",
    description="작성자와 스페이스 owner만 지울 수 있다. 그 외에는 403이다.",
)
def delete_timeline_item(
    context: TimelineMemberContext, current_user: CurrentUser, db: DbSession
) -> None:
    """타임라인 항목 삭제."""
    timeline_service.ensure_can_edit(context.item, context.membership, current_user)
    timeline_service.delete_item(db, context.item)
    return None
