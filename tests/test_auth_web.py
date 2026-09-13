"""웹 세션 인증 테스트.

앱(JWT)과 달리 웹은 Redis 세션을 쓴다. 서버가 로그인 상태를 들고 있으므로
로그아웃 시 즉시 무효화되는지, 쿠키가 안전하게 설정되는지를 중점적으로 확인한다.
"""

import redis
from fastapi.testclient import TestClient

from app.auth import session as session_store
from app.core.config import get_settings

settings = get_settings()

VALID_PAYLOAD = {
    "email": "web@example.com",
    "nickname": "웹사용자",
    "password": "Password1234!",
    # 가입 조건이라 셋 다 True여야 통과한다 (app/auth/schemas.py).
    "agreed_terms": True,
    "agreed_privacy": True,
    "is_over_14": True,
}


def web_register(client: TestClient, **overrides):
    """웹 회원가입 헬퍼."""
    return client.post("/api/v1/auth/web/register", json={**VALID_PAYLOAD, **overrides})


def web_login(client: TestClient, **overrides):
    """웹 로그인 헬퍼."""
    payload = {"email": VALID_PAYLOAD["email"], "password": VALID_PAYLOAD["password"]}
    return client.post("/api/v1/auth/web/login", json={**payload, **overrides})


# ── 회원가입 ──────────────────────────────────────


def test_web_register_sets_session_cookie(client: TestClient) -> None:
    response = web_register(client)

    assert response.status_code == 201
    assert response.json()["email"] == VALID_PAYLOAD["email"]
    # 세션 ID는 응답 본문이 아니라 쿠키로만 전달되어야 한다.
    assert settings.session_cookie_name in response.cookies
    assert "session_id" not in response.json()


def test_web_register_cookie_is_httponly(client: TestClient) -> None:
    """자바스크립트가 세션을 읽지 못하도록 httponly가 반드시 켜져 있어야 한다."""
    response = web_register(client)

    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    # CSRF 방어를 위해 samesite도 설정되어야 한다.
    assert "samesite=lax" in set_cookie


def test_web_register_creates_personal_space(client: TestClient) -> None:
    """웹 가입도 앱 가입과 동일하게 개인 스페이스가 만들어져야 한다."""
    response = web_register(client)

    assert response.json()["default_space_id"] is not None


# ── 로그인 ────────────────────────────────────────


def test_web_login_success(client: TestClient) -> None:
    web_register(client)
    client.cookies.clear()

    response = web_login(client)

    assert response.status_code == 200
    assert settings.session_cookie_name in response.cookies


def test_web_login_wrong_password(client: TestClient) -> None:
    web_register(client)
    client.cookies.clear()

    response = web_login(client, password="wrongpassword")

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"
    assert settings.session_cookie_name not in response.cookies


# ── 세션으로 보호된 API 접근 ──────────────────────


def test_session_cookie_authenticates_shared_endpoint(client: TestClient) -> None:
    """웹 세션으로 로그인하면 Bearer 토큰 없이도 /auth/me가 동작해야 한다.

    웹과 앱이 같은 API를 공유한다는 것이 이 프로젝트의 전제다.
    """
    web_register(client)

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == VALID_PAYLOAD["email"]


def test_no_session_no_token_is_unauthorized(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_invalid_session_cookie_rejected(client: TestClient) -> None:
    client.cookies.set(settings.session_cookie_name, "does-not-exist")

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


# ── 로그아웃 ──────────────────────────────────────


def test_web_logout_invalidates_session_immediately(client: TestClient) -> None:
    """JWT와 달리 세션은 로그아웃 즉시 무효화되어야 한다.

    이것이 웹에 세션을 쓰는 핵심 이유다.
    """
    web_register(client)
    session_id = client.cookies[settings.session_cookie_name]

    assert client.get("/api/v1/auth/me").status_code == 200

    logout = client.post("/api/v1/auth/web/logout")
    assert logout.status_code == 204

    # 쿠키를 지웠더라도 서버에 세션이 남아 있으면 안 된다.
    # 훔친 쿠키를 되돌려 넣어도 통과하지 못해야 한다.
    client.cookies.set(settings.session_cookie_name, session_id)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_web_logout_without_session_succeeds(client: TestClient) -> None:
    """세션이 없어도 로그아웃은 성공해야 한다.

    만료된 세션으로 로그아웃을 눌렀을 때 401이 나면 쿠키가 남아 로그인 화면으로
    가지 못하는 상황이 생긴다.
    """
    assert client.post("/api/v1/auth/web/logout").status_code == 204


def test_logout_all_removes_every_session(
    client: TestClient, redis_client: redis.Redis
) -> None:
    """다른 기기에서 만든 세션까지 모두 폐기되어야 한다."""
    web_register(client)
    user_id = client.get("/api/v1/auth/me").json()["id"]

    # 다른 기기에서 로그인한 상황을 직접 세션을 만들어 재현한다.
    other_device_session = session_store.create_session(
        redis_client, user_id, user_agent="다른 기기"
    )
    assert len(session_store.list_user_sessions(redis_client, user_id)) == 2

    assert client.post("/api/v1/auth/web/logout-all").status_code == 204

    assert session_store.list_user_sessions(redis_client, user_id) == []
    assert session_store.get_session_user_id(redis_client, other_device_session) is None


# ── 기기 목록 ─────────────────────────────────────


def test_list_sessions(client: TestClient) -> None:
    web_register(client)

    response = client.get("/api/v1/auth/web/sessions")

    assert response.status_code == 200
    sessions = response.json()["sessions"]
    assert len(sessions) == 1
    # 세션 ID 전체는 인증 수단이므로 노출되면 안 된다.
    assert len(sessions[0]["id"]) == 8
    assert "last_seen_at" in sessions[0]


def test_list_sessions_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/auth/web/sessions").status_code == 401


# ── 세션 저장소 단위 동작 ─────────────────────────


def test_session_expiry_is_extended_on_use(redis_client: redis.Redis) -> None:
    """세션은 쓸 때마다 유효기간이 갱신되어 "마지막 사용 후 N일"로 동작해야 한다."""
    session_id = session_store.create_session(redis_client, user_id=1)
    key = f"session:{session_id}"

    # TTL을 인위적으로 줄인 뒤 조회하면 다시 원래 기간으로 늘어나야 한다.
    redis_client.expire(key, 60)
    assert redis_client.ttl(key) <= 60

    session_store.get_session_user_id(redis_client, session_id)

    assert redis_client.ttl(key) > 60


def test_app_and_web_can_coexist(client: TestClient) -> None:
    """같은 계정을 앱(JWT)과 웹(세션)에서 동시에 쓸 수 있어야 한다."""
    web_register(client)
    # 앱 로그인으로 JWT를 따로 발급받는다.
    tokens = client.post(
        "/api/v1/auth/login",
        json={"email": VALID_PAYLOAD["email"], "password": VALID_PAYLOAD["password"]},
    ).json()

    # 세션 쿠키로 접근
    assert client.get("/api/v1/auth/me").status_code == 200

    # 쿠키를 지우고 JWT로 접근
    client.cookies.clear()
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 200
