"""일기 엔드포인트.

경로는 모두 일정 아래에 있다. 일기는 일정 없이 존재하지 않고, 접근 권한도 일정과 같기
때문이다 (docs/API_SPEC.md 7장).

**경로에 작성자 id가 없다.** 누구의 본문인지는 인증 정보로 정한다. 경로에 id를 두면
"남의 본문 자리에 내 글을 쓰는" 요청 형태가 만들어지고 그때마다 권한을 다시 검사해야
한다. 남의 본문은 아예 지목할 수 없게 두는 편이 안전하다.
"""

from fastapi import APIRouter, Response, status

from app.auth.dependencies import CurrentUser, DbSession
from app.diaries import service
from app.diaries.schemas import (
    DiaryEntryListResponse,
    DiaryEntryResponse,
    DiaryEntryUpsertRequest,
)
from app.schedules.dependencies import ScheduleMemberContext

router = APIRouter(prefix="/schedules/{schedule_id}", tags=["diaries"])


@router.put(
    "/diary",
    response_model=DiaryEntryResponse,
    summary="내 일기 작성 또는 수정",
    description=(
        "이 일정에 대한 **내** 본문을 저장한다. 없으면 만들고 있으면 고치므로 "
        "클라이언트가 먼저 존재 여부를 확인할 필요가 없다. "
        "처음 만들면 201, 기존 글을 고치면 200이다."
    ),
)
def upsert_my_diary(
    payload: DiaryEntryUpsertRequest,
    context: ScheduleMemberContext,
    current_user: CurrentUser,
    db: DbSession,
    response: Response,
) -> DiaryEntryResponse:
    """내 일기 작성/수정. 같은 일정에 여러 명이 각자 하나씩 쓸 수 있다."""
    entry, created = service.upsert_my_entry(
        db=db,
        schedule=context.schedule,
        user=current_user,
        content=payload.content,
        mood=payload.mood,
    )
    # 새로 만든 경우와 고친 경우를 상태 코드로 구분한다. 본문 형태는 같다.
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return DiaryEntryResponse.model_validate(entry)


@router.get(
    "/diary",
    response_model=DiaryEntryResponse,
    summary="내 일기 조회",
    description="이 일정에 대한 **내** 본문을 돌려준다. 아직 쓰지 않았으면 404다.",
)
def get_my_diary(
    context: ScheduleMemberContext, current_user: CurrentUser, db: DbSession
) -> DiaryEntryResponse:
    """내 일기 조회."""
    entry = service.get_my_entry(db, context.schedule, current_user)
    return DiaryEntryResponse.model_validate(entry)


@router.delete(
    "/diary",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="내 일기 삭제",
    description=(
        "이 일정에 대한 **내** 본문만 지운다. 같은 하루에 다른 사람이 쓴 글과 "
        "공용인 사진·타임라인은 남는다."
    ),
)
def delete_my_diary(
    context: ScheduleMemberContext, current_user: CurrentUser, db: DbSession
) -> None:
    """내 일기 삭제."""
    service.delete_my_entry(db, context.schedule, current_user)
    return None


@router.get(
    "/diaries",
    response_model=DiaryEntryListResponse,
    summary="일정의 전체 일기 조회",
    description=(
        "같은 일정에 달린 작성자별 본문을 먼저 쓴 순서로 모두 돌려준다. "
        "활성 멤버는 서로의 본문을 볼 수 있으며 멤버별 비공개 항목은 없다."
    ),
)
def list_diaries(context: ScheduleMemberContext, db: DbSession) -> DiaryEntryListResponse:
    """일정의 전체 일기 조회. 완료 상세 화면이 사용한다."""
    entries = service.list_entries(db, context.schedule)
    return DiaryEntryListResponse(
        items=[DiaryEntryResponse.model_validate(entry) for entry in entries]
    )
