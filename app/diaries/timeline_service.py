"""수동 방문 타임라인 로직.

사용자가 "몇 시에 어디를 갔는지"를 직접 남기는 기능이다. 사진과 마찬가지로 작성자별
본문이 아니라 **일정에 직접 달린다.** 하루의 실제 동선은 하나이기 때문이다
(docs/API_SPEC.md 7장).

GPS나 위치 권한에 기대지 않는다. 자동 타임라인이 나중에 추가돼도 이 수동 API는 유지되며,
자동으로 만들어진 항목도 사용자가 고치거나 지울 수 있어야 한다
(docs/DEVELOPMENT_BRIEF.md 9절).

접근 권한은 이 모듈이 판단하지 않는다. 라우터가 일정 단위로 이미 확인한다. 예외는
수정·삭제 권한 하나뿐이다.
"""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.diaries.errors import InvalidTimelinePlaceError, TimelineEditForbiddenError
from app.diaries.models import DiaryTimelineItem
from app.places.models import SchedulePlace
from app.schedules.models import Schedule
from app.spaces.models import SPACE_ROLE_OWNER, SpaceMember
from app.users.models import User


def list_items(db: Session, schedule: Schedule) -> list[DiaryTimelineItem]:
    """하루의 타임라인을 시간순으로 돌려준다."""
    return list(
        db.scalars(
            select(DiaryTimelineItem)
            .options(
                joinedload(DiaryTimelineItem.schedule_place).joinedload(SchedulePlace.place),
                joinedload(DiaryTimelineItem.created_by_user),
            )
            .where(DiaryTimelineItem.schedule_id == schedule.id)
            # 같은 시각의 항목이 여럿이면 sort_order로, 그것도 같으면 id로 정렬한다.
            # 정렬 기준이 하나라도 빠지면 새로고침할 때마다 순서가 뒤바뀔 수 있다.
            .order_by(
                DiaryTimelineItem.occurred_at,
                DiaryTimelineItem.sort_order,
                DiaryTimelineItem.id,
            )
        ).all()
    )


def _validate_place(db: Session, schedule: Schedule, schedule_place_id: int | None) -> None:
    """연결하려는 장소가 이 일정의 장소인지 확인한다.

    :raises InvalidTimelinePlaceError: 다른 일정의 장소를 가리킬 때

    검사하지 않으면 남의 일정에 담긴 장소 id를 넣어 그 장소의 존재 여부를 알아낼 수 있다.
    """
    if schedule_place_id is None:
        return

    exists = db.scalar(
        select(SchedulePlace.id).where(
            SchedulePlace.id == schedule_place_id,
            SchedulePlace.schedule_id == schedule.id,
        )
    )
    if exists is None:
        raise InvalidTimelinePlaceError()


def _next_sort_order(db: Session, schedule: Schedule) -> int:
    """새 항목이 붙을 자리. 항상 맨 뒤다.

    시각으로 먼저 정렬하므로 이 값은 "같은 시각끼리의 순서"만 결정한다. 전역 최대값에
    1을 더하면 같은 시각에 나중에 넣은 항목이 뒤에 오게 되어 입력 순서가 보존된다.
    """
    last = db.scalar(
        select(func.max(DiaryTimelineItem.sort_order)).where(
            DiaryTimelineItem.schedule_id == schedule.id
        )
    )
    return 0 if last is None else last + 1


def add_item(
    db: Session,
    schedule: Schedule,
    user: User,
    occurred_at: datetime,
    title: str,
    memo: str | None,
    schedule_place_id: int | None,
) -> DiaryTimelineItem:
    """타임라인 항목을 추가한다.

    :param schedule_place_id: 일정에 담아둔 장소와 연결할 때만 준다. 계획에 없던 곳이나
        장소가 아닌 활동("점심 먹기")은 title만으로 남길 수 있다
    :raises InvalidTimelinePlaceError: 다른 일정의 장소를 가리킬 때
    """
    _validate_place(db, schedule, schedule_place_id)

    item = DiaryTimelineItem(
        schedule_id=schedule.id,
        occurred_at=occurred_at,
        schedule_place_id=schedule_place_id,
        title=title,
        memo=memo,
        sort_order=_next_sort_order(db, schedule),
        created_by=user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_item(db: Session, item: DiaryTimelineItem, changes: dict) -> DiaryTimelineItem:
    """타임라인 항목을 부분 수정한다.

    :param changes: 실제로 요청 본문에 담겨 온 필드만 들어 있는 dict.
        "안 보냄"과 "null로 보냄"을 구분해야 memo와 장소 연결을 지울 수 있다
    :raises InvalidTimelinePlaceError: 다른 일정의 장소로 바꾸려 할 때
    """
    if "schedule_place_id" in changes:
        _validate_place(db, item.schedule, changes["schedule_place_id"])

    for field, value in changes.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def ensure_can_edit(item: DiaryTimelineItem, membership: SpaceMember, user: User) -> None:
    """항목을 고치거나 지울 권한이 있는지 확인한다.

    :raises TimelineEditForbiddenError: 남이 남긴 항목을 일반 멤버가 건드릴 때

    작성자와 스페이스 owner만 허용한다. 일정 삭제·사진 삭제와 같은 규칙이다
    (docs/API_SPEC.md 4.6절, 7장).
    """
    if membership.role == SPACE_ROLE_OWNER:
        return
    if item.created_by == user.id:
        return
    raise TimelineEditForbiddenError()


def delete_item(db: Session, item: DiaryTimelineItem) -> None:
    """타임라인 항목을 지운다."""
    db.delete(item)
    db.commit()
