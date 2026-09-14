"""인증 비즈니스 로직.

라우터(HTTP)와 DB 사이의 계층이다. 라우터는 요청을 받아 이 함수들을 호출하기만 하고,
"이메일이 중복인가", "개인 스페이스를 같이 만들어야 하는가" 같은 규칙은 전부 여기 모은다.
"""

from datetime import datetime, timedelta, timezone

from fastapi import Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit import service as audit
from app.audit.models import AuditAction
from app.auth import security
from app.core.errors import AppError
from app.spaces.models import (
    PERSONAL_SPACE_DEFAULT_NAME,
    SPACE_MEMBER_STATUS_ACTIVE,
    SPACE_ROLE_OWNER,
    SPACE_TYPE_PERSONAL,
    Space,
    SpaceMember,
)
from app.legal import service as legal
from app.legal.models import (
    CONSENT_AGE_OVER_14,
    CONSENT_PRIVACY,
    CONSENT_TERMS,
    UserConsent,
)
from app.users.models import (
    LOGIN_ALLOWED_STATUSES,
    USER_IN_USE,
    USER_STATUS_ACTIVE,
    USER_STATUS_LOCKED,
    User,
)


# 로그인 잠금 정책.
#
# 연속 실패가 이 횟수에 닿으면 계정이 잠기고, 잠금 시각이 지나면 다음 로그인 시도
# 때 저절로 풀린다. 풀어주는 별도 작업을 돌리지 않아도 되게 한 구조다.
#
# 계정 단위로 세기 때문에, 남의 이메일로 일부러 5번 틀려 그 사람을 잠글 수 있다.
# 잠금이 5분으로 짧아 실제 피해는 작지만, 이 한계를 알고 고른 값이다. 더 막으려면
# IP 단위 제한을 함께 둬야 한다.
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 5


class EmailAlreadyExistsError(AppError):
    """이미 가입된 이메일로 회원가입을 시도한 경우."""

    def __init__(self) -> None:
        super().__init__(
            code="EMAIL_ALREADY_EXISTS",
            message="이미 가입된 이메일입니다.",
            status_code=status.HTTP_409_CONFLICT,
            field="email",
        )


class NicknameAlreadyExistsError(AppError):
    """이미 사용 중인 닉네임으로 회원가입을 시도한 경우."""

    def __init__(self) -> None:
        super().__init__(
            code="NICKNAME_ALREADY_EXISTS",
            message="이미 사용 중인 닉네임입니다.",
            status_code=status.HTTP_409_CONFLICT,
            field="nickname",
        )


class InvalidCredentialsError(AppError):
    """이메일이 없거나 비밀번호가 틀린 경우.

    두 경우를 구분해서 알려주면 "이 이메일은 가입되어 있다"는 정보가 새어나가므로
    (계정 열거 공격) 하나의 예외로 합치고, field도 특정하지 않는다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="INVALID_CREDENTIALS",
            message="이메일 또는 비밀번호가 올바르지 않습니다.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class AccountLockedError(AppError):
    """연속 로그인 실패로 계정이 잠긴 경우.

    로그인 실패(401)와 다른 코드를 쓴다. 비밀번호를 더 눌러봐야 소용없다는 것을
    사용자가 알아야 하고, 클라이언트도 "다시 입력해 보세요"가 아니라 기다리라는
    안내를 띄워야 한다.

    **남은 시간은 알려주지 않는다.** 정확한 해제 시각을 주면 공격자가 그 시점에 맞춰
    다음 묶음을 던지도록 자동화하기 쉬워진다. 사용자에게도 "잠시 후"면 충분하다 —
    5분이라 다시 확인하러 오는 사이에 대개 풀려 있다.

    이 문구는 "이 이메일이 존재한다"는 사실을 드러낸다. 로그인 실패를 한 문구로
    합쳐 계정 열거를 막아둔 것과 상충하지만, 5회를 틀려야 도달하는 상태이고
    기다리라는 안내를 못 하면 사용자가 고장으로 오해한다. 열거 비용(5회 시도)과
    안내 가치를 견줘 안내를 택했다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="ACCOUNT_LOCKED",
            message=(
                f"로그인 시도가 {MAX_LOGIN_ATTEMPTS}회 실패해 계정이 잠겼습니다. "
                "잠시 후 다시 시도해 주세요."
            ),
            status_code=status.HTTP_423_LOCKED,
        )


class AccountUnavailableError(AppError):
    """휴면 등으로 로그인할 수 없는 상태인 경우.

    잠금과 달리 시간이 지나도 풀리지 않는다. 해제 절차가 생기기 전까지는 문의하도록
    안내한다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="ACCOUNT_UNAVAILABLE",
            message="사용할 수 없는 계정입니다. 고객센터로 문의해 주세요.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class InvalidRefreshTokenError(AppError):
    """refresh token이 만료됐거나 위조된 경우. 클라이언트는 재로그인을 유도해야 한다."""

    def __init__(self) -> None:
        super().__init__(
            code="INVALID_REFRESH_TOKEN",
            message="세션이 만료되었습니다. 다시 로그인해 주세요.",
            status_code=status.HTTP_401_UNAUTHORIZED,
            field="refresh_token",
        )


def get_user_by_email(db: Session, email: str) -> User | None:
    """이메일로 사용자를 찾는다. 없으면 None.

    **탈퇴한 계정도 함께 찾는다.** 회원가입의 중복 검사가 이 함수를 쓰는데, 여기서
    탈퇴 계정을 걸러버리면 같은 이메일로 다시 가입할 수 있다고 판단해 INSERT까지 갔다가
    UNIQUE 제약에 걸려 500이 난다. 탈퇴해도 이메일은 계속 점유된 상태로 둔다.

    로그인은 이 함수를 쓰되 탈퇴 여부를 따로 본다 (authenticate_user 참고).
    """
    return db.scalar(select(User).where(User.email == email))


def get_user_by_id(db: Session, user_id: int) -> User | None:
    """id로 지금 쓸 수 있는 사용자를 찾는다. 없거나 쓸 수 없으면 None.

    탈퇴한 계정을 여기서 걸러야 이미 발급된 access token이 더 이상 통하지 않는다.
    JWT는 무상태라 서버가 회수할 수 없어서, 매 요청 이 조회에서 막는 것이 유일한
    차단 지점이다. 세션 쿠키 쪽은 탈퇴 시 Redis에서 지우지만 그것만 믿지 않는다.

    휴면(10)도 같이 막는다. 계정을 잠재우는 목적이 "지금 쓰지 못하게" 하는 것이므로
    이미 열려 있는 세션도 끊겨야 한다.

    **잠금(11)은 막지 않는다.** 로그인 잠금은 비밀번호를 눌러보는 것을 늦추는 장치이지
    세션을 끊는 장치가 아니다. 여기서 막으면 남의 이메일로 일부러 5번 틀리는 것만으로
    그 사람을 쓰던 기기에서 쫓아낼 수 있다 (authenticate_user의 잠금 정책 주석 참고).
    """
    user = db.get(User, user_id)
    if user is None or user.use != USER_IN_USE:
        return None
    if user.status not in (*LOGIN_ALLOWED_STATUSES, USER_STATUS_LOCKED):
        return None
    return user


def _record_consents(db: Session, user_id: int) -> None:
    """가입 시 받은 동의를 남긴다.

    :param user_id: flush로 id가 확보된 사용자

    **동의한 문서의 개정일을 함께 남긴다.** 약관이 바뀌면 "이 사람이 어느 판본에
    동의했는가"를 알아야 재동의 대상을 고를 수 있다. 만 14세 확인은 문서가 아니라
    가입 자격이라 개정일이 없다.

    가입과 같은 트랜잭션에 넣는다. 사용자만 만들어지고 동의 기록이 빠지면, 동의를
    받았는지 입증할 수 없는 계정이 생긴다.
    """
    revisions = {
        CONSENT_TERMS: legal.get_document(CONSENT_TERMS).updated_at,
        CONSENT_PRIVACY: legal.get_document(CONSENT_PRIVACY).updated_at,
        CONSENT_AGE_OVER_14: None,
    }
    for code, revision in revisions.items():
        db.add(UserConsent(user_id=user_id, code=code, document_revision=revision))


def register_user(
    db: Session, email: str, nickname: str, password: str, request: Request | None = None
) -> User:
    """새 사용자를 만들고 개인 스페이스까지 한 트랜잭션 안에서 생성한다.

    개인 스페이스를 같은 트랜잭션에 묶는 이유: 사용자는 있는데 스페이스가 없는 상태가
    되면 일정을 하나도 만들 수 없는 반쪽짜리 계정이 된다. 둘 다 성공하거나 둘 다
    실패해야 한다 (docs/SPACE_MODEL_SPEC.md 7.1).

    :param db: DB 세션
    :param email: 가입 이메일 (스키마에서 형식 검증 완료)
    :param nickname: 표시 이름
    :param password: 평문 비밀번호 (여기서 해싱한다)
    :param request: 감사 로그에 접속 IP·User-Agent를 남기기 위한 요청 객체
    :raises EmailAlreadyExistsError: 이메일이 이미 존재할 때
    :raises NicknameAlreadyExistsError: 닉네임이 이미 존재할 때
    :return: 생성된 User (개인 스페이스가 default_space_id로 설정된 상태)
    """
    if get_user_by_email(db, email) is not None:
        raise EmailAlreadyExistsError()

    if db.scalar(select(User).where(User.nickname == nickname)) is not None:
        raise NicknameAlreadyExistsError()

    user = User(
        email=email,
        nickname=nickname,
        password_hash=security.hash_password(password),
    )
    db.add(user)
    # commit이 아니라 flush다. 아래에서 space.owner_id에 넣을 user.id를 DB에서
    # 받아와야 하는데, 트랜잭션은 아직 열어둔 채로 id만 확보하기 위함이다.
    db.flush()

    personal_space = Space(
        type=SPACE_TYPE_PERSONAL,
        name=PERSONAL_SPACE_DEFAULT_NAME,
        owner_id=user.id,
    )
    db.add(personal_space)
    db.flush()

    # 스페이스를 만든 것만으로는 접근 권한이 생기지 않는다. 모든 권한 검사는
    # SpaceMember를 보기 때문에 본인을 owner 멤버로 명시적으로 등록한다.
    db.add(
        SpaceMember(
            space_id=personal_space.id,
            user_id=user.id,
            role=SPACE_ROLE_OWNER,
            status=SPACE_MEMBER_STATUS_ACTIVE,
        )
    )

    # 사용자가 따로 지정하기 전까지는 개인 스페이스가 앱 실행 시 열리는 기본 스페이스다.
    user.default_space_id = personal_space.id

    # 동의 값은 스키마(RegisterRequest)가 이미 전부 True인지 확인했다. 여기서는
    # 받은 사실을 남기기만 한다.
    _record_consents(db, user.id)

    # commit=False로 회원가입과 같은 트랜잭션에 합류시킨다. 가입이 롤백되면
    # "가입했다"는 기록도 함께 사라져야 사실과 어긋나지 않는다.
    audit.record(
        db,
        AuditAction.REGISTER,
        user_id=user.id,
        actor_email=user.email,
        request=request,
        detail={"nickname": user.nickname},
        commit=False,
    )

    db.commit()
    db.refresh(user)
    return user


def _is_locked(user: User) -> bool:
    """지금 잠겨 있는가.

    `_release_lock_if_expired`가 먼저 돌아 만료된 잠금을 풀어두므로, 여기까지
    잠긴 채로 오는 것은 아직 시간이 남은 경우뿐이다. 그래도 시각을 한 번 더 보는
    이유는 이 함수만 따로 불러도 답이 맞아야 하기 때문이다.
    """
    if user.status != USER_STATUS_LOCKED or user.locked_until is None:
        return False
    return user.locked_until > datetime.now(timezone.utc)


def _release_lock_if_expired(db: Session, user: User) -> None:
    """잠금 시각이 지났으면 풀어준다.

    별도 배치를 돌리지 않고 다음 로그인 시도 때 푸는 이유: 잠긴 계정은 본인이 다시
    시도할 때만 의미가 있고, 그 순간에 풀면 충분하다. 배치를 두면 그것이 멈췄을 때
    아무도 모르게 계정이 계속 잠겨 있는다.
    """
    if user.status != USER_STATUS_LOCKED or user.locked_until is None:
        return
    if user.locked_until > datetime.now(timezone.utc):
        return

    user.status = USER_STATUS_ACTIVE
    user.login_failed_count = 0
    user.locked_until = None
    db.commit()


def _count_failure(db: Session, user: User, request: Request | None) -> None:
    """실패를 세고, 한도에 닿으면 계정을 잠근다.

    감사 로그를 남기는 것까지 여기서 한다. 세는 곳과 남기는 곳이 갈리면 한쪽만
    고쳐져 기록과 상태가 어긋난다.
    """
    user.login_failed_count += 1
    locked = user.login_failed_count >= MAX_LOGIN_ATTEMPTS

    if locked:
        user.status = USER_STATUS_LOCKED
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)

    # 상태 변경과 감사 로그를 한 트랜잭션에 묶는다. 잠갔는데 기록이 없으면 나중에
    # "왜 잠겼는지"를 설명할 수 없다.
    audit.record(
        db,
        AuditAction.LOGIN_FAILED,
        user_id=user.id,
        actor_email=user.email,
        request=request,
        detail={"reason": "WRONG_PASSWORD", "failed_count": user.login_failed_count},
        commit=False,
    )
    if locked:
        audit.record(
            db,
            AuditAction.ACCOUNT_LOCKED,
            user_id=user.id,
            actor_email=user.email,
            request=request,
            detail={"minutes": LOCKOUT_MINUTES},
            commit=False,
        )
    db.commit()


def authenticate_user(
    db: Session, email: str, password: str, request: Request | None = None
) -> User:
    """이메일과 비밀번호로 사용자를 인증한다.

    성공과 실패를 모두 감사 로그에 남긴다. 실패 기록은 무차별 대입 시도를 발견하는
    유일한 단서이므로 반드시 남겨야 한다.

    :param request: 감사 로그에 접속 IP·User-Agent를 남기기 위한 요청 객체
    :raises InvalidCredentialsError: 이메일이 없거나 비밀번호가 틀린 경우
    :return: 인증된 User
    """
    user = get_user_by_email(db, email)
    if user is None:
        # 존재하지 않는 이메일이어도 비밀번호를 실제로 검증한 것과 비슷한 시간을 쓰게 한다.
        # 응답 속도 차이로 "이 이메일은 가입되어 있다"를 알아내는 타이밍 공격을 막기 위함이다.
        security.verify_password(password, security.DUMMY_PASSWORD_HASH)
        # 사용자를 특정할 수 없으므로 user_id는 비우고 시도한 이메일만 남긴다.
        audit.record(
            db,
            AuditAction.LOGIN_FAILED,
            actor_email=email,
            request=request,
            detail={"reason": "USER_NOT_FOUND"},
        )
        raise InvalidCredentialsError()

    # 비밀번호를 보기 전에 잠금부터 확인한다. 잠긴 동안의 시도는 검증조차 하지 않아야
    # 무차별 대입이 실제로 느려진다. 시간이 지났으면 여기서 풀고 계속 진행한다.
    _release_lock_if_expired(db, user)
    if _is_locked(user):
        audit.record(
            db,
            AuditAction.LOGIN_FAILED,
            user_id=user.id,
            actor_email=email,
            request=request,
            detail={"reason": "LOCKED"},
        )
        raise AccountLockedError()

    if not security.verify_password(password, user.password_hash):
        _count_failure(db, user, request)
        raise InvalidCredentialsError()

    # 비밀번호가 맞아도 탈퇴한 계정은 들여보내지 않는다. 비밀번호를 확인한 뒤에 보는
    # 이유: 순서를 뒤집으면 아무 비밀번호나 넣어도 "탈퇴한 계정"이라는 답이 돌아와,
    # 그 이메일이 가입돼 있었다는 사실이 새어 나간다.
    #
    # 오류도 로그인 실패와 같은 것을 쓴다. "탈퇴한 계정입니다"라고 알려주면 친절하지만,
    # 같은 이유로 계정 열거에 쓰인다. 정말 탈퇴한 본인이라면 다시 가입을 시도했을 때
    # 이메일 중복(409)으로 안내된다.
    if user.use != USER_IN_USE:
        audit.record(
            db,
            AuditAction.LOGIN_FAILED,
            user_id=user.id,
            actor_email=email,
            request=request,
            detail={"reason": "DELETED_ACCOUNT"},
        )
        raise InvalidCredentialsError()

    # 휴면 등 로그인할 수 없는 상태. 탈퇴와 달리 존재를 감추지 않는다 — 본인이
    # 해제 절차를 밟아야 하는데 "비밀번호가 틀렸다"고만 하면 영영 못 들어온다.
    if user.status not in LOGIN_ALLOWED_STATUSES:
        audit.record(
            db,
            AuditAction.LOGIN_FAILED,
            user_id=user.id,
            actor_email=email,
            request=request,
            detail={"reason": "STATUS", "status": user.status},
        )
        raise AccountUnavailableError()

    # 성공했으니 실패 기록을 지운다. 남겨두면 다음에 몇 번만 틀려도 잠긴다.
    if user.login_failed_count or user.locked_until is not None:
        user.login_failed_count = 0
        user.locked_until = None
        db.commit()

    audit.record(
        db,
        AuditAction.LOGIN_SUCCESS,
        user_id=user.id,
        actor_email=user.email,
        request=request,
    )
    return user


def issue_tokens(user_id: int) -> tuple[str, str]:
    """로그인/재발급 시 돌려줄 (access token, refresh token) 쌍을 만든다."""
    return security.create_access_token(user_id), security.create_refresh_token(user_id)


def refresh_access_token(db: Session, refresh_token: str) -> tuple[str, str]:
    """refresh token을 검증하고 새 토큰 쌍을 발급한다.

    무상태 방식이라 토큰을 DB에 저장하지 않는다. 대신 토큰이 가리키는 사용자가
    아직 존재하는지는 반드시 확인한다. 탈퇴한 사용자의 토큰이 만료 전까지
    계속 통과하는 것을 막기 위해서다.

    :raises InvalidRefreshTokenError: 토큰이 유효하지 않거나 사용자가 없는 경우
    :return: 새로 발급한 (access token, refresh token)
    """
    user_id = security.decode_token(refresh_token, security.TOKEN_TYPE_REFRESH)
    if user_id is None:
        raise InvalidRefreshTokenError()

    if get_user_by_id(db, user_id) is None:
        raise InvalidRefreshTokenError()

    return issue_tokens(user_id)
