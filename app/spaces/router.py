"""스페이스 엔드포인트.

경로의 `{space_id}`는 내부 정수가 아니라 **UUID**다. 순차 정수를 노출하면 번호를
순서대로 바꿔가며 남의 스페이스를 탐색할 수 있기 때문이다.

권한 검사는 의존성(`MemberContext` / `OwnerContext`)이 라우터 진입 전에 끝낸다.
"""

from fastapi import APIRouter, Request, status

from app.audit import service as audit
from app.audit.models import AuditAction
from app.auth.dependencies import CurrentUser, DbSession, RedisClient
from app.core import rate_limit
from app.spaces import service
from app.spaces.dependencies import MemberContext, OwnerContext
from app.spaces.schemas import (
    DefaultSpaceUpdateRequest,
    JoinCodeResponse,
    SpaceCreateRequest,
    SpaceJoinRequest,
    SpaceListResponse,
    SpaceMemberListResponse,
    SpaceResponse,
    SpaceUpdateRequest,
    TransferOwnershipRequest,
)

router = APIRouter(prefix="/spaces", tags=["spaces"])

# 감사 로그의 resource_type 값
RESOURCE_SPACE = "space"


@router.get(
    "",
    response_model=SpaceListResponse,
    summary="내 스페이스 목록",
    description=(
        "내가 활성 멤버인 스페이스를 돌려준다. 보관된 스페이스와 나간 스페이스는 제외된다. "
        "개인 스페이스가 항상 먼저 온다."
    ),
)
def list_spaces(current_user: CurrentUser, db: DbSession) -> SpaceListResponse:
    """스페이스 목록 조회. 앱 실행 시 스페이스 전환기를 그리는 데 사용한다."""
    return SpaceListResponse(spaces=service.list_my_spaces(db, current_user))


@router.post(
    "",
    response_model=SpaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="공유 스페이스 생성",
    description="새 공유 스페이스를 만들고 생성자를 owner로 등록한다. 참여 번호가 함께 발급된다.",
)
def create_space(
    payload: SpaceCreateRequest,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> SpaceResponse:
    """공유 스페이스 생성."""
    space = service.create_shared_space(db, current_user, payload.name, payload.icon)
    audit.record(
        db,
        AuditAction.SPACE_CREATED,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SPACE,
        request=request,
        detail={"name": space.name},
    )
    return space


@router.post(
    "/join",
    response_model=SpaceResponse,
    summary="참여 번호로 참여",
    description=(
        "참여 번호를 입력해 공유 스페이스에 들어간다. 대소문자와 공백·하이픈은 "
        "서버가 정규화하므로 클라이언트가 미리 다듬지 않아도 된다. "
        "계정당 1분에 10번, IP당 30번까지 받고, 넘으면 429 `TOO_MANY_REQUESTS`다."
    ),
)
def join_space(
    payload: SpaceJoinRequest,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    redis_client: RedisClient,
) -> SpaceResponse:
    """참여 번호로 스페이스 참여.

    **번호가 맞는지 보기 전에 센다.** 틀린 번호를 넣어 보는 것이 바로 막아야 할 시도라서,
    성공·실패와 관계없이 모든 입력을 센다.

    IP 제한은 X-Forwarded-For를 쓰므로 **실서버에서 프록시가 이 헤더를 덮어쓰도록 설정하기
    전까지는 우회할 수 있다**(요청마다 헤더를 바꿔 보내면 된다). 그래서 계정 제한이 진짜
    방어선이고 IP 제한은 보조막이다. IP를 알 수 없으면 IP 제한은 건너뛴다.
    """
    rate_limit.enforce(
        redis_client,
        "space-join:user",
        current_user.id,
        limit=service.JOIN_ATTEMPTS_PER_MINUTE_PER_USER,
    )
    ip_address, _ = audit.extract_client_info(request)
    if ip_address:
        rate_limit.enforce(
            redis_client,
            "space-join:ip",
            ip_address,
            limit=service.JOIN_ATTEMPTS_PER_MINUTE_PER_IP,
        )

    space = service.join_by_code(db, current_user, payload.join_code)
    audit.record(
        db,
        AuditAction.SPACE_JOINED,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SPACE,
        request=request,
        detail={"name": space.name},
    )
    return space


@router.get(
    "/{space_id}",
    response_model=SpaceResponse,
    summary="스페이스 상세",
    description="스페이스 정보와 내 역할을 돌려준다. 활성 멤버만 조회할 수 있다.",
)
def get_space(context: MemberContext, current_user: CurrentUser, db: DbSession) -> SpaceResponse:
    """스페이스 상세 조회."""
    return service.to_response(db, context.space, current_user, context.membership.role)


@router.patch(
    "/{space_id}",
    response_model=SpaceResponse,
    summary="스페이스 수정",
    description="이름과 아이콘을 수정한다. owner만 가능하며, 보낸 필드만 변경된다.",
)
def update_space(
    payload: SpaceUpdateRequest,
    context: OwnerContext,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> SpaceResponse:
    """스페이스 이름·아이콘 수정."""
    space = service.update_space(db, context.space, payload.name, payload.icon)
    audit.record(
        db,
        AuditAction.SPACE_UPDATED,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SPACE,
        resource_id=space.id,
        request=request,
        detail={"name": space.name},
    )
    return service.to_response(db, space, current_user, context.membership.role)


@router.delete(
    "/{space_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="스페이스 보관",
    description=(
        "스페이스를 보관한다(소프트 삭제). owner만 가능하다. "
        "실제로 지우지 않고 목록에서 감추므로 함께 쌓은 기록이 사라지지 않는다. "
        "개인 스페이스와 현재 기본 스페이스는 보관할 수 없다."
    ),
)
def archive_space(
    context: OwnerContext,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    """스페이스 보관."""
    space_id = context.space.id
    space_name = context.space.name
    service.archive_space(db, context.space, current_user)
    audit.record(
        db,
        AuditAction.SPACE_ARCHIVED,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SPACE,
        resource_id=space_id,
        request=request,
        detail={"name": space_name},
    )
    return None


@router.post(
    "/{space_id}/join-code/regenerate",
    response_model=JoinCodeResponse,
    summary="참여 번호 재발급",
    description="참여 번호를 새로 발급한다. owner만 가능하며 이전 번호는 즉시 무효가 된다.",
)
def regenerate_join_code(
    context: OwnerContext,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> JoinCodeResponse:
    """참여 번호 재발급. 번호가 외부에 유출됐을 때 사용한다."""
    new_code = service.regenerate_join_code(db, context.space)
    audit.record(
        db,
        AuditAction.JOIN_CODE_REGENERATED,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SPACE,
        resource_id=context.space.id,
        request=request,
    )
    return JoinCodeResponse(join_code=new_code)


@router.get(
    "/{space_id}/members",
    response_model=SpaceMemberListResponse,
    summary="멤버 목록",
    description="스페이스의 활성 멤버를 돌려준다. owner가 먼저 온다.",
)
def list_members(context: MemberContext, db: DbSession) -> SpaceMemberListResponse:
    """멤버 목록 조회."""
    return SpaceMemberListResponse(members=service.list_members(db, context.space))


@router.delete(
    "/{space_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="멤버 제거",
    description="owner가 멤버를 내보낸다. 제거된 멤버는 즉시 접근 권한을 잃는다.",
)
def remove_member(
    user_id: int,
    context: OwnerContext,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    """멤버 제거."""
    service.remove_member(db, context.space, user_id, current_user.id)
    audit.record(
        db,
        AuditAction.MEMBER_REMOVED,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SPACE,
        resource_id=context.space.id,
        request=request,
        detail={"removed_user_id": user_id},
    )
    return None


@router.post(
    "/{space_id}/leave",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="스페이스 나가기",
    description=(
        "스페이스에서 나간다. owner는 혼자 남아 있을 때만 나갈 수 있고 이때 스페이스가 "
        "함께 보관된다. 다른 멤버가 있으면 소유권을 먼저 넘겨야 한다. "
        "개인 스페이스는 나갈 수 없다."
    ),
)
def leave_space(
    context: MemberContext,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    """스페이스 나가기."""
    space_id = context.space.id
    archived = service.leave_space(db, context.space, context.membership, current_user)
    audit.record(
        db,
        AuditAction.SPACE_LEFT,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SPACE,
        resource_id=space_id,
        request=request,
        detail={"archived_space": archived},
    )
    return None


@router.post(
    "/{space_id}/transfer-ownership",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="소유권 이전",
    description="다른 활성 멤버에게 owner를 넘긴다. 기존 owner는 일반 멤버가 된다.",
)
def transfer_ownership(
    payload: TransferOwnershipRequest,
    context: OwnerContext,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    """소유권 이전."""
    service.transfer_ownership(db, context.space, current_user.id, payload.user_id)
    audit.record(
        db,
        AuditAction.OWNERSHIP_TRANSFERRED,
        user_id=current_user.id,
        actor_email=current_user.email,
        resource_type=RESOURCE_SPACE,
        resource_id=context.space.id,
        request=request,
        detail={"new_owner_id": payload.user_id},
    )
    return None
