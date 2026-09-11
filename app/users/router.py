"""사용자 설정 엔드포인트.

인증(로그인·회원가입)은 app/auth가 담당하고, 여기서는 로그인한 사용자가 자기
설정을 바꾸는 API를 다룬다.
"""

from fastapi import APIRouter, Request, status

from app.audit import service as audit
from app.audit.models import AuditAction
from app.auth.dependencies import CurrentUser, DbSession, RedisClient
from app.auth.schemas import UserResponse
from app.core.config import get_settings
from app.spaces import service as space_service
from app.spaces.schemas import DefaultSpaceUpdateRequest, SpaceResponse
from app.users import service
from app.users.schemas import PasswordChangeRequest, ProfileUpdateRequest

settings = get_settings()

router = APIRouter(prefix="/users", tags=["users"])


@router.put(
    "/me/default-space",
    response_model=SpaceResponse,
    summary="기본 스페이스 변경",
    description=(
        "앱 실행 시 열리는 스페이스를 바꾼다. 자기가 활성 멤버인 스페이스만 지정할 수 있다. "
        "여기서 지정한 스페이스는 지정을 바꾸기 전까지 삭제할 수 없다."
    ),
)
def update_default_space(
    payload: DefaultSpaceUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> SpaceResponse:
    """기본 스페이스 변경."""
    return space_service.set_default_space(db, current_user, payload.space_id)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="프로필 수정",
    description=(
        "닉네임을 바꾼다. 이미 다른 사람이 쓰는 닉네임이면 409다. "
        "이메일은 로그인 수단이라 여기서 바꾸지 않는다."
    ),
)
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: CurrentUser,
    db: DbSession,
) -> UserResponse:
    """프로필 수정."""
    user = service.update_profile(db, current_user, payload.nickname)
    return UserResponse.from_user(user)


@router.put(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="비밀번호 변경",
    description=(
        "현재 비밀번호를 확인한 뒤 새 비밀번호로 바꾼다. 새 비밀번호는 회원가입과 같은 "
        "규칙을 따른다. 성공하면 **지금 쓰는 기기를 뺀 다른 웹 세션이 모두 끊긴다.** "
        "앱(JWT)은 무상태라 이 호출로 끊기지 않으며 토큰 만료까지 유효하다."
    ),
)
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    redis_client: RedisClient,
) -> None:
    """비밀번호 변경."""
    # 웹 세션으로 들어온 요청이면 그 세션만 남긴다. 앱이면 쿠키가 없어 None이 된다.
    keep_session_id = request.cookies.get(settings.session_cookie_name)

    removed = service.change_password(
        db=db,
        redis_client=redis_client,
        user=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
        keep_session_id=keep_session_id,
    )

    # 비밀번호 변경은 계정을 되찾는 과정에서 다투기 쉬운 지점이라 이력을 남긴다.
    # 행위 코드는 감사 로그 모델에 미리 정의돼 있었다(app/audit/models.py).
    audit.record(
        db,
        AuditAction.PASSWORD_CHANGED,
        user_id=current_user.id,
        actor_email=current_user.email,
        request=request,
        detail={"revoked_sessions": removed},
    )
    return None
