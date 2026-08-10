"""일정 엔드포인트.

경로가 두 갈래다 (docs/API_SPEC.md 5장).

- `/spaces/{space_id}/schedules` — 목록·생성. 어느 스페이스인지 경로가 말해준다.
- `/schedules/{schedule_id}` — 상세·수정·삭제·완료. 일정 id만으로 찾는다.

권한 검사는 의존성이 라우터 진입 전에 끝낸다. 앞쪽은 `MemberContext`(그 스페이스의
활성 멤버인가), 뒤쪽은 `ScheduleMemberContext`(그 일정이 속한 스페이스의 활성 멤버인가)다.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Request, status

from app.audit import service as audit
from app.audit.models import AuditAction
from app.auth.dependencies import CurrentUser, DbSession
from app.schedules import service
from app.schedules.dependencies import ScheduleMemberContext
from app.schedules.schemas import (
    SCHEDULE_STATUSES,
    ScheduleCreateRequest,
    ScheduleListResponse,
    ScheduleResponse,
    ScheduleUpdateRequest,
)
from app.spaces.dependencies import MemberContext

# 스페이스 하위 경로. 경로 파라미터 이름이 spaces 라우터와 같아야 MemberContext가
# {space_id}를 읽을 수 있다.
space_schedules_router = APIRouter(prefix="/spaces/{space_id}/schedules", tags=["schedules"])
schedules_router = APIRouter(prefix="/schedules", tags=["schedules"])

# 감사 로그의 resource_type 값
RESOURCE_SCHEDULE = "schedule"

StatusQuery = Annotated[
    str | None,
    Query(
        # 함수 인자 이름은 status_filter지만 쿼리 키는 명세대로 status여야 한다.
        # (status는 fastapi.status와 이름이 겹쳐 인자명으로 쓰기 어렵다)
        alias="status",
        pattern=f"^({'|'.join(SCHEDULE_STATUSES)})$",
        description="planned / completed / canceled 중 하나. 생략하면 전체",
    ),
]


@space_schedules_router.get(
    "",
    response_model=ScheduleListResponse,
    summary="기간별 일정 목록",
    description=(
        "스페이스의 일정을 start_at 오름차순으로 돌려준다. "
        "`from`/`to`는 `YYYY-MM-DD`이며 **한국 시간(Asia/Seoul) 기준 하루**로 해석한다. "
        "생략하면 이번 달 1일부터 말일까지다. "
        "기간에 걸치기만 하면 포함되므로, 여러 날에 걸친 일정은 시작·종료가 범위 밖이어도 나온다."
    ),
)
def list_schedules(
    context: MemberContext,
    db: DbSession,
    from_date: Annotated[date | None, Query(alias="from", description="조회 시작일 (그날 포함)")] = None,
    to_date: Annotated[date | None, Query(alias="to", description="조회 종료일 (그날 포함)")] = None,
    status_filter: StatusQuery = None,
) -> ScheduleListResponse:
    """기간별 일정 목록 조회. 캘린더와 일정 목록 화면이 사용한다."""
    items = service.list_schedules(db, context.space, from_date, to_date, status_filter)
    return ScheduleListResponse(items=items)


@space_schedules_router.post(
    "",
    response_model=ScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="일정 생성",
    description=(
        "현재 스페이스에 일정을 만든다. 활성 멤버라면 누구나 만들 수 있다. "
        "`space_id`는 경로에서 정해지므로 본문에 넣지 않는다."
    ),
)
def create_schedule(
    payload: ScheduleCreateRequest,
    context: MemberContext,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> ScheduleResponse:
    """일정 생성."""
    schedule = service.create_schedule(
        db,
        context.space,
        current_user,
        title=payload.title,
        description=payload.description,
        start_at=payload.start_at,
        end_at=payload.end_at,
    )
    audit.record(
        db,
        AuditAction.SCHEDULE_CREATED,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SCHEDULE,
        resource_id=schedule.id,
        request=request,
        detail={"title": schedule.title, "space_id": context.space.id},
    )
    return service.load_response(db, schedule)


@schedules_router.get(
    "/{schedule_id}",
    response_model=ScheduleResponse,
    summary="일정 상세",
    description="일정 하나를 돌려준다. 그 일정이 속한 스페이스의 활성 멤버만 볼 수 있다.",
)
def get_schedule(context: ScheduleMemberContext, db: DbSession) -> ScheduleResponse:
    """일정 상세 조회."""
    return service.load_response(db, context.schedule)


@schedules_router.patch(
    "/{schedule_id}",
    response_model=ScheduleResponse,
    summary="일정 수정",
    description=(
        "보낸 필드만 변경한다. 활성 멤버라면 남이 만든 일정도 수정할 수 있다 "
        "(함께 만드는 일정이므로). `description`에 null을 보내면 내용이 지워진다."
    ),
)
def update_schedule(
    payload: ScheduleUpdateRequest,
    context: ScheduleMemberContext,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> ScheduleResponse:
    """일정 수정."""
    # exclude_unset으로 "안 보낸 필드"와 "null로 보낸 필드"를 구분한다.
    # 이게 없으면 title만 바꾸려는 요청이 description까지 null로 지워버린다.
    changes = payload.model_dump(exclude_unset=True)
    schedule = service.update_schedule(db, context.schedule, changes)
    audit.record(
        db,
        AuditAction.SCHEDULE_UPDATED,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SCHEDULE,
        resource_id=schedule.id,
        request=request,
        detail={"fields": sorted(changes)},
    )
    return service.load_response(db, schedule)


@schedules_router.post(
    "/{schedule_id}/complete",
    response_model=ScheduleResponse,
    summary="일정 완료 표시",
    description=(
        "일정을 완료 상태로 바꾼다. 이미 완료인 일정에 다시 호출해도 성공한다 "
        "(재시도해도 결과가 같도록)."
    ),
)
def complete_schedule(context: ScheduleMemberContext, db: DbSession) -> ScheduleResponse:
    """일정 완료 표시."""
    schedule = service.complete_schedule(db, context.schedule)
    return service.load_response(db, schedule)


@schedules_router.delete(
    "/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="일정 삭제",
    description=(
        "일정을 삭제한다. 스페이스 owner는 모든 일정을, 일반 멤버는 본인이 만든 일정만 "
        "지울 수 있다. 딸린 장소·일기·사진도 함께 사라진다."
    ),
)
def delete_schedule(
    context: ScheduleMemberContext,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    """일정 삭제."""
    service.ensure_can_delete(db, context.schedule, context.membership, current_user)

    # 삭제 후에는 읽을 수 없으므로 감사 로그에 남길 값을 미리 꺼내 둔다.
    schedule_id = context.schedule.id
    title = context.schedule.title

    service.delete_schedule(db, context.schedule)
    audit.record(
        db,
        AuditAction.SCHEDULE_DELETED,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SCHEDULE,
        resource_id=schedule_id,
        request=request,
        detail={"title": title},
    )
    return None
