"""인증 엔드포인트.

라우터는 HTTP 입출력만 담당한다. 실제 규칙 판단은 service.py가 하고, 여기서는
요청을 풀어 서비스에 넘기고 결과를 스키마로 감싸는 일만 한다.
"""

from fastapi import APIRouter, Request, status

from app.audit import service as audit
from app.audit.models import AuditAction
from app.auth import service
from app.auth.dependencies import CurrentUser, DbSession
from app.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="회원가입",
    description=(
        "새 계정을 만들고 개인 스페이스를 함께 생성한다. "
        "가입 직후 바로 로그인 상태가 되도록 토큰을 함께 돌려준다."
    ),
)
def register(payload: RegisterRequest, request: Request, db: DbSession) -> RegisterResponse:
    """회원가입. 이메일/닉네임 중복 시 409를 반환한다."""
    user = service.register_user(
        db=db,
        email=payload.email,
        nickname=payload.nickname,
        password=payload.password,
        request=request,
    )
    access_token, refresh_token = service.issue_tokens(user.id)
    return RegisterResponse(
        user=UserResponse.from_user(user),
        tokens=TokenResponse(access_token=access_token, refresh_token=refresh_token),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="로그인",
    description="이메일과 비밀번호로 access token과 refresh token을 발급받는다.",
)
def login(payload: LoginRequest, request: Request, db: DbSession) -> TokenResponse:
    """로그인. 이메일이 없거나 비밀번호가 틀리면 동일하게 401을 반환한다."""
    user = service.authenticate_user(
        db=db, email=payload.email, password=payload.password, request=request
    )
    access_token, refresh_token = service.issue_tokens(user.id)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="토큰 재발급",
    description=(
        "refresh token으로 새 access token을 발급받는다. "
        "access token이 만료되어 401을 받으면 이 엔드포인트를 호출한 뒤 원래 요청을 재시도한다."
    ),
)
def refresh(payload: RefreshRequest, db: DbSession) -> TokenResponse:
    """토큰 재발급. 만료·위조된 토큰이면 401을 반환하므로 클라이언트는 재로그인을 유도한다."""
    access_token, refresh_token = service.refresh_access_token(db=db, refresh_token=payload.refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="로그아웃",
    description=(
        "무상태(stateless) 방식이라 서버에 저장된 세션이 없다. "
        "이 호출은 성공을 알릴 뿐이며, 실제 로그아웃은 클라이언트가 저장된 토큰을 "
        "지우는 것으로 완료된다. 지우기 전의 토큰은 만료 시각까지 유효하다."
    ),
)
def logout(current_user: CurrentUser, request: Request, db: DbSession) -> None:
    """로그아웃. 토큰 폐기는 클라이언트 책임이며, 여기서는 인증 확인과 이력 기록만 한다."""
    audit.record(
        db,
        AuditAction.LOGOUT,
        user_id=current_user.id,
        actor_email=current_user.email,
        request=request,
        detail={"client": "app"},
    )
    return None


@router.get(
    "/me",
    response_model=UserResponse,
    summary="내 정보 조회",
    description="access token으로 현재 로그인한 사용자 정보를 조회한다.",
)
def get_me(current_user: CurrentUser) -> UserResponse:
    """내 정보 조회. default_space_id로 첫 화면에 열 스페이스를 결정한다."""
    return UserResponse.from_user(current_user)
