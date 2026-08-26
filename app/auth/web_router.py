"""웹 브라우저용 인증 엔드포인트 (세션 방식).

앱은 `/auth/*`의 JWT를 쓰고, 웹은 여기 `/auth/web/*`의 세션을 쓴다.
차이는 인증 수단뿐이고, 로그인 이후 호출하는 나머지 API는 완전히 동일하다.

세션을 쓰는 이유는 서버가 로그인 상태를 들고 있어야 강제 로그아웃과 접속 기기
관리가 가능하기 때문이다. 토큰을 httpOnly 쿠키로 주기 때문에 자바스크립트가
세션 ID를 읽을 수 없어 XSS로 탈취당하지 않는다.
"""

from fastapi import APIRouter, Request, Response, status

from app.audit import service as audit
from app.audit.models import AuditAction
from app.auth import service, session as session_store
from app.auth.dependencies import CurrentUser, DbSession, RedisClient
from app.auth.schemas import LoginRequest, RegisterRequest, UserResponse
from app.core.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/auth/web", tags=["auth-web"])


def _set_session_cookie(response: Response, session_id: str) -> None:
    """세션 ID를 httpOnly 쿠키로 심는다.

    :param response: 쿠키를 붙일 응답 객체
    :param session_id: create_session이 돌려준 세션 ID
    """
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_id,
        # httponly: 자바스크립트에서 document.cookie로 읽을 수 없게 막는다.
        #           XSS 공격으로 세션을 훔쳐가는 경로를 차단하는 핵심 설정이다.
        httponly=True,
        # secure: HTTPS에서만 쿠키를 전송한다. 로컬은 http라 False,
        #         실서버는 반드시 True로 둬야 중간에서 가로채이지 않는다.
        secure=settings.session_cookie_secure,
        # samesite=lax: 다른 사이트에서 우리 API로 요청을 보낼 때 쿠키를 붙이지 않아
        #               CSRF를 상당 부분 막아준다. 일반적인 페이지 이동은 허용된다.
        samesite="lax",
        max_age=settings.session_expire_days * 24 * 60 * 60,
        path="/",
        domain=settings.session_cookie_domain,
    )


def _clear_session_cookie(response: Response) -> None:
    """브라우저에서 세션 쿠키를 지운다.

    설정값(path, domain 등)이 심을 때와 다르면 브라우저가 다른 쿠키로 인식해
    지워지지 않으므로, 심을 때와 동일한 값을 넘겨야 한다.
    """
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        domain=settings.session_cookie_domain,
    )


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="회원가입 (웹)",
    description=(
        "계정과 개인 스페이스를 만들고 곧바로 로그인 상태로 만든다. "
        "세션 ID는 응답 본문이 아니라 httpOnly 쿠키로 전달된다."
    ),
)
def web_register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: DbSession,
    redis_client: RedisClient,
) -> UserResponse:
    """웹 회원가입. 성공 시 세션 쿠키가 설정된다."""
    user = service.register_user(
        db=db,
        email=payload.email,
        nickname=payload.nickname,
        password=payload.password,
        request=request,
    )
    session_id = session_store.create_session(
        client=redis_client,
        user_id=user.id,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_session_cookie(response, session_id)
    return UserResponse.from_user(user)


@router.post(
    "/login",
    response_model=UserResponse,
    summary="로그인 (웹)",
    description=(
        "이메일과 비밀번호로 세션을 만든다. 세션 ID는 httpOnly 쿠키로 전달되므로 "
        "프론트엔드가 직접 저장할 필요가 없고, 이후 요청에 브라우저가 자동으로 붙인다. "
        "단, 교차 출처 요청이면 fetch에 `credentials: 'include'`를 반드시 지정해야 한다."
    ),
)
def web_login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: DbSession,
    redis_client: RedisClient,
) -> UserResponse:
    """웹 로그인. 실패 시 이메일 존재 여부를 구분하지 않고 401을 반환한다."""
    user = service.authenticate_user(
        db=db, email=payload.email, password=payload.password, request=request
    )
    session_id = session_store.create_session(
        client=redis_client,
        user_id=user.id,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    _set_session_cookie(response, session_id)
    return UserResponse.from_user(user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="로그아웃 (웹)",
    description=(
        "서버에서 세션을 삭제하고 쿠키를 지운다. JWT와 달리 이 시점에 즉시 무효화되므로 "
        "쿠키를 복사해 두었더라도 다시 사용할 수 없다."
    ),
)
def web_logout(
    request: Request, response: Response, db: DbSession, redis_client: RedisClient
) -> None:
    """웹 로그아웃.

    인증을 요구하지 않는다. 이미 만료된 세션으로 로그아웃을 눌렀을 때 401이 뜨면
    쿠키가 남아 로그인 화면으로 못 가는 상황이 생기기 때문이다.
    """
    session_id = request.cookies.get(settings.session_cookie_name)
    if session_id:
        # 세션을 지우기 전에 누구였는지 확인해야 이력에 행위자를 남길 수 있다.
        user_id = session_store.get_session_user_id(redis_client, session_id)
        session_store.delete_session(redis_client, session_id)
        if user_id is not None:
            audit.record(
                db,
                AuditAction.LOGOUT,
                user_id=user_id,
                request=request,
                detail={"client": "web"},
            )
    _clear_session_cookie(response)
    return None


@router.post(
    "/logout-all",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="모든 기기에서 로그아웃",
    description=(
        "현재 사용자의 모든 웹 세션을 삭제한다. 비밀번호 유출이 의심될 때 사용한다. "
        "앱(JWT)은 무상태라 이 호출로 끊기지 않으며 토큰 만료까지 유효하다."
    ),
)
def web_logout_all(
    current_user: CurrentUser,
    request: Request,
    response: Response,
    db: DbSession,
    redis_client: RedisClient,
) -> None:
    """현재 사용자의 모든 세션을 폐기한다."""
    removed = session_store.delete_all_user_sessions(redis_client, current_user.id)
    audit.record(
        db,
        AuditAction.LOGOUT_ALL,
        user_id=current_user.id,
        actor_email=current_user.email,
        request=request,
        detail={"removed_sessions": removed},
    )
    _clear_session_cookie(response)
    return None


@router.get(
    "/sessions",
    summary="접속 중인 기기 목록",
    description="현재 사용자의 활성 웹 세션 목록을 돌려준다. 설정 화면의 기기 관리에 사용한다.",
)
def list_sessions(current_user: CurrentUser, redis_client: RedisClient) -> dict[str, list[dict[str, str]]]:
    """접속 기기 목록 조회.

    세션 ID 자체는 인증 수단이므로 응답에 그대로 내보내지 않고, 화면에서 구분할 수
    있을 만큼만 앞 8자를 잘라 보여준다.
    """
    sessions = session_store.list_user_sessions(redis_client, current_user.id)
    return {
        "sessions": [
            {
                "id": item["session_id"][:8],
                "user_agent": item.get("user_agent", ""),
                "ip_address": item.get("ip_address", ""),
                "created_at": item.get("created_at", ""),
                "last_seen_at": item.get("last_seen_at", ""),
            }
            for item in sessions
        ]
    }
