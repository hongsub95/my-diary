"""일기 엔드포인트.

경로는 모두 일정 아래에 있다. 일기는 일정 없이 존재하지 않고, 접근 권한도 일정과 같기
때문이다 (docs/API_SPEC.md 7장).

**경로에 작성자 id가 없다.** 누구의 본문인지는 인증 정보로 정한다. 경로에 id를 두면
"남의 본문 자리에 내 글을 쓰는" 요청 형태가 만들어지고 그때마다 권한을 다시 검사해야
한다. 남의 본문은 아예 지목할 수 없게 두는 편이 안전하다.
"""

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.auth.dependencies import CurrentUser, DbSession
from app.diaries import feed_service, service
from app.diaries.schemas import (
    DiaryAuthorResponse,
    DiaryEntryListResponse,
    DiaryEntryResponse,
    DiaryEntryUpsertRequest,
    DiaryFeedItemResponse,
    DiaryFeedResponse,
)
from app.schedules.dependencies import ScheduleMemberContext
from app.schedules.experience import resolve_phase
from app.schedules.service import build_summary
from app.spaces.dependencies import MemberContext

router = APIRouter(prefix="/schedules/{schedule_id}", tags=["diaries"])
# 기록 탭 목록은 일정이 아니라 스페이스 단위다. 경로 파라미터 이름이 spaces 라우터와
# 같아야 MemberContext가 {space_id}를 읽을 수 있다.
space_diaries_router = APIRouter(prefix="/spaces/{space_id}/diaries", tags=["diaries"])


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


@space_diaries_router.get(
    "",
    response_model=DiaryFeedResponse,
    summary="기록 목록 (기록 탭)",
    description=(
        "완료했거나 지나간 하루를 최신순으로 돌려준다. 정렬 기준은 완료 시각이며, "
        "완료를 누르지 않았으면 종료 시각으로 대신한다. "
        "`next_cursor`를 다음 요청의 `cursor`에 그대로 넣어 이어 받는다. "
        "기본은 기록이 있는 하루만 담고, `include_pending=true`면 기록 대기도 포함한다."
    ),
)
def list_space_diaries(
    context: MemberContext,
    db: DbSession,
    cursor: Annotated[str | None, Query(description="이전 응답의 next_cursor")] = None,
    limit: Annotated[int, Query(ge=1, le=feed_service.MAX_LIMIT, description="한 페이지 개수")] = feed_service.DEFAULT_LIMIT,
    year: Annotated[int | None, Query(ge=2000, le=2100, description="연도 필터. month와 함께 준다")] = None,
    month: Annotated[int | None, Query(ge=1, le=12, description="월 필터")] = None,
    include_pending: Annotated[bool, Query(description="기록이 없는 지난 하루도 포함할지")] = False,
) -> DiaryFeedResponse:
    """기록 탭 목록 조회."""
    page = feed_service.list_space_diaries(
        db=db,
        space=context.space,
        cursor=cursor,
        limit=limit,
        year=year,
        month=month,
        include_pending=include_pending,
    )

    # 작성자는 페이지에 담긴 일정만 한 번에 모아 온다. 카드마다 조회하면 질의가 는다.
    authors_by_schedule = feed_service.load_authors(db, [row[0].id for row in page.rows])

    items = []
    for schedule, sorted_at, place_count, *summary_row in page.rows:
        content, summary = build_summary(summary_row)
        items.append(
            DiaryFeedItemResponse(
                schedule_id=schedule.id,
                title=schedule.title,
                start_at=schedule.start_at,
                end_at=schedule.end_at,
                sorted_at=sorted_at,
                completed_at=schedule.completed_at,
                experience_phase=resolve_phase(
                    schedule.status, schedule.start_at, schedule.end_at, content
                ),
                place_count=place_count,
                authors=[
                    DiaryAuthorResponse.model_validate(author)
                    for author in authors_by_schedule.get(schedule.id, [])
                ],
                record_summary=summary,
            )
        )

    return DiaryFeedResponse(items=items, next_cursor=page.next_cursor)
