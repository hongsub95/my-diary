"""일정 접근 권한을 확인하는 FastAPI 의존성.

`/schedules/{schedule_id}` 경로에는 스페이스가 드러나지 않는다. 그래서 일정을 먼저
찾은 뒤 그 일정이 속한 스페이스의 활성 멤버인지 확인한다. 판정 기준은 스페이스와
동일하다 — **작성자인지가 아니라 활성 멤버인지**를 본다.
"""

from typing import Annotated

from fastapi import Depends, Path
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.auth.dependencies import CurrentUser, DbSession
from app.schedules.errors import ScheduleNotFoundError
from app.schedules.models import Schedule
from app.spaces.dependencies import get_active_membership
from app.spaces.models import SpaceMember


class ScheduleContext:
    """권한 검사를 통과한 요청의 일정 정보 묶음.

    라우터가 일정과 멤버십을 다시 조회하지 않도록 함께 전달한다. 멤버십은 삭제 권한
    판단(owner인지)에 쓰인다.
    """

    def __init__(self, schedule: Schedule, membership: SpaceMember) -> None:
        self.schedule = schedule
        self.membership = membership


def require_schedule_member(
    schedule_id: Annotated[int, Path(description="일정 id")],
    current_user: CurrentUser,
    db: DbSession,
) -> ScheduleContext:
    """일정을 찾고 요청자가 그 스페이스의 활성 멤버인지 확인한다.

    :raises ScheduleNotFoundError: 없거나 접근 권한이 없을 때 (둘을 구분하지 않는다)

    없는 일정과 남의 일정에 같은 404를 주는 이유: 구분하면 id를 1씩 올려가며
    "몇 번까지 일정이 존재하는가"를 알아낼 수 있다.
    """
    schedule = db.scalar(
        select(Schedule)
        # 응답을 만들 때 바로 필요하므로 여기서 함께 읽는다.
        .options(joinedload(Schedule.space), joinedload(Schedule.created_by_user))
        .where(Schedule.id == schedule_id)
    )
    if schedule is None:
        raise ScheduleNotFoundError()

    membership = get_active_membership(db, schedule.space, current_user.id)
    if membership is None:
        raise ScheduleNotFoundError()

    return ScheduleContext(schedule, membership)


# 라우터에서 반복해 쓰는 타입 별칭.
ScheduleMemberContext = Annotated[ScheduleContext, Depends(require_schedule_member)]
