"""감사 로그 테스트.

감사 로그는 나중에 복원할 수 없는 기록이므로, 남아야 할 사건이 실제로 남는지를
확인하는 것이 핵심이다.
"""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.models import AuditAction, AuditLog

PAYLOAD = {
    "email": "audit@example.com",
    "nickname": "감사테스트",
    "password": "Password1234!",
    # 가입 조건이라 셋 다 True여야 통과한다 (app/auth/schemas.py).
    "agreed_terms": True,
    "agreed_privacy": True,
    "is_over_14": True,
}


def logs_of(db: Session, action: str) -> list[AuditLog]:
    """특정 행위의 감사 로그를 시간순으로 가져온다."""
    return list(
        db.scalars(select(AuditLog).where(AuditLog.action == action).order_by(AuditLog.id))
    )


def register(client: TestClient, **overrides):
    return client.post("/api/v1/auth/register", json={**PAYLOAD, **overrides})


# ── 회원가입 ──────────────────────────────────────


def test_register_is_recorded(client: TestClient, db_session: Session) -> None:
    register(client)

    entries = logs_of(db_session, AuditAction.REGISTER)
    assert len(entries) == 1
    assert entries[0].actor_email == PAYLOAD["email"]
    assert entries[0].user_id is not None
    assert entries[0].detail["nickname"] == PAYLOAD["nickname"]


def test_failed_register_leaves_no_log(client: TestClient, db_session: Session) -> None:
    """가입이 실패하면 "가입했다"는 기록도 남으면 안 된다.

    감사 로그를 같은 트랜잭션에 묶었기 때문에 롤백되어야 한다.
    """
    register(client)
    register(client, nickname="다른닉")  # 이메일 중복으로 409

    assert len(logs_of(db_session, AuditAction.REGISTER)) == 1


# ── 로그인 ────────────────────────────────────────


def test_login_success_is_recorded(client: TestClient, db_session: Session) -> None:
    register(client)
    client.post("/api/v1/auth/login", json={"email": PAYLOAD["email"], "password": PAYLOAD["password"]})

    entries = logs_of(db_session, AuditAction.LOGIN_SUCCESS)
    assert len(entries) == 1
    assert entries[0].actor_email == PAYLOAD["email"]


def test_wrong_password_is_recorded(client: TestClient, db_session: Session) -> None:
    """실패 기록은 무차별 대입을 발견하는 유일한 단서라 반드시 남아야 한다."""
    register(client)
    client.post("/api/v1/auth/login", json={"email": PAYLOAD["email"], "password": "wrongpassword"})

    entries = logs_of(db_session, AuditAction.LOGIN_FAILED)
    assert len(entries) == 1
    assert entries[0].detail["reason"] == "WRONG_PASSWORD"
    # 계정이 존재하므로 행위자를 특정할 수 있어야 한다.
    assert entries[0].user_id is not None


def test_unknown_email_is_recorded_without_user_id(
    client: TestClient, db_session: Session
) -> None:
    """가입되지 않은 이메일로 시도한 것도 기록하되 user_id는 비운다."""
    client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "whatever12"})

    entries = logs_of(db_session, AuditAction.LOGIN_FAILED)
    assert len(entries) == 1
    assert entries[0].user_id is None
    assert entries[0].actor_email == "nobody@example.com"
    assert entries[0].detail["reason"] == "USER_NOT_FOUND"


def test_failed_login_records_client_info(client: TestClient, db_session: Session) -> None:
    """이상 접속 조사를 위해 IP와 User-Agent가 남아야 한다."""
    client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "whatever12"},
        # HTTP 헤더는 latin-1만 담을 수 있어 한글을 넣으면 요청 자체가 만들어지지 않는다.
        headers={"User-Agent": "TestBrowser/1.0", "X-Forwarded-For": "203.0.113.10"},
    )

    entry = logs_of(db_session, AuditAction.LOGIN_FAILED)[0]
    assert entry.ip_address == "203.0.113.10"
    assert entry.user_agent == "TestBrowser/1.0"


def test_malformed_forwarded_header_does_not_break_request(
    client: TestClient, db_session: Session
) -> None:
    """위조된 X-Forwarded-For가 와도 요청 자체는 정상 처리되어야 한다.

    ip_address 컬럼이 INET 타입이라 형식에 맞지 않는 값을 그대로 넣으면 INSERT가
    실패하고, 회원가입처럼 같은 트랜잭션에 묶인 작업까지 함께 롤백된다.
    """
    response = client.post(
        "/api/v1/auth/register",
        json=PAYLOAD,
        headers={"X-Forwarded-For": "'; DROP TABLE nl_users; --"},
    )

    assert response.status_code == 201
    entry = logs_of(db_session, AuditAction.REGISTER)[0]
    # 형식에 맞지 않는 IP는 저장하지 않고 나머지 정보만 남긴다.
    assert entry.ip_address is None
    assert entry.actor_email == PAYLOAD["email"]


def test_repeated_failures_are_all_recorded(client: TestClient, db_session: Session) -> None:
    """연속 실패가 모두 남아야 무차별 대입 패턴을 볼 수 있다."""
    register(client)
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": PAYLOAD["email"], "password": "bad_password"})

    assert len(logs_of(db_session, AuditAction.LOGIN_FAILED)) == 5


# ── 로그아웃 ──────────────────────────────────────


def test_app_logout_is_recorded(client: TestClient, db_session: Session) -> None:
    token = register(client).json()["tokens"]["access_token"]
    client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})

    entries = logs_of(db_session, AuditAction.LOGOUT)
    assert len(entries) == 1
    assert entries[0].detail["client"] == "app"


def test_web_logout_is_recorded(client: TestClient, db_session: Session) -> None:
    client.post("/api/v1/auth/web/register", json={**PAYLOAD, "email": "web@example.com", "nickname": "웹감사"})
    client.post("/api/v1/auth/web/logout")

    entries = logs_of(db_session, AuditAction.LOGOUT)
    assert len(entries) == 1
    assert entries[0].detail["client"] == "web"


def test_logout_all_records_session_count(client: TestClient, db_session: Session) -> None:
    client.post("/api/v1/auth/web/register", json={**PAYLOAD, "email": "web2@example.com", "nickname": "웹감사2"})
    client.post("/api/v1/auth/web/logout-all")

    entries = logs_of(db_session, AuditAction.LOGOUT_ALL)
    assert len(entries) == 1
    assert entries[0].detail["removed_sessions"] == 1


# ── 기록 보존 ─────────────────────────────────────


def test_audit_log_survives_user_deletion(client: TestClient, db_session: Session) -> None:
    """사용자를 지워도 감사 로그는 남아야 한다.

    user_id에 외래키를 걸지 않은 이유가 이것이다. CASCADE였다면 탈퇴와 동시에
    그 사람의 행위 이력이 통째로 사라져 감사 로그의 목적을 잃는다.
    """
    from app.users.models import User

    register(client)
    user = db_session.scalar(select(User).where(User.email == PAYLOAD["email"]))
    user_id = user.id

    db_session.delete(user)
    db_session.commit()

    entries = list(db_session.scalars(select(AuditLog).where(AuditLog.user_id == user_id)))
    assert len(entries) >= 1
    # 계정이 사라져도 당시 이메일 스냅샷으로 누구였는지 알 수 있어야 한다.
    assert entries[0].actor_email == PAYLOAD["email"]
