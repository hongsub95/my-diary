"""인증 API 테스트.

docs/DEVELOPMENT_BRIEF.md 10절의 필수 테스트 중 인증 관련 항목을 다룬다.
"""

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.spaces.models import (
    PERSONAL_SPACE_DEFAULT_NAME,
    SPACE_MEMBER_STATUS_ACTIVE,
    SPACE_ROLE_OWNER,
    SPACE_TYPE_PERSONAL,
    Space,
    SpaceMember,
)
from app.users.models import USER_ROLE_MASTER, USER_ROLE_USER, User

VALID_PAYLOAD = {
    "email": "hong@example.com",
    "nickname": "홍섭",
    "password": "Password1234!",
}


def register(client: TestClient, **overrides) -> object:
    """테스트용 회원가입 헬퍼. 기본 payload에서 필요한 값만 바꿔 호출한다."""
    payload = {**VALID_PAYLOAD, **overrides}
    return client.post("/api/v1/auth/register", json=payload)


def login(client: TestClient, email: str = VALID_PAYLOAD["email"], password: str = VALID_PAYLOAD["password"]):
    """테스트용 로그인 헬퍼."""
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def auth_header(token: str) -> dict[str, str]:
    """Authorization 헤더를 만든다."""
    return {"Authorization": f"Bearer {token}"}


# ── 회원가입 ──────────────────────────────────────


def test_register_success(client: TestClient) -> None:
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == VALID_PAYLOAD["email"]
    assert body["user"]["nickname"] == VALID_PAYLOAD["nickname"]
    # 가입으로는 절대 마스터가 만들어지면 안 된다. 등급 상승은 운영자가 DB에서만 한다.
    assert body["user"]["role"] == USER_ROLE_USER
    # 가입 직후 바로 로그인 상태가 되도록 토큰이 함께 와야 한다.
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]
    # 비밀번호 해시는 어떤 경우에도 응답에 나가면 안 된다.
    assert "password" not in body["user"]
    assert "password_hash" not in body["user"]


def test_register_cannot_self_assign_master_role(client: TestClient, db_session: Session) -> None:
    """요청 본문에 role을 끼워 넣어도 마스터가 되면 안 된다.

    RegisterRequest에 role 필드가 없으므로 pydantic이 조용히 버리지만, 나중에 누군가
    스키마에 role을 추가하면 권한 상승 구멍이 된다. 그 순간을 여기서 잡는다.
    """
    response = register(client, role=USER_ROLE_MASTER)

    assert response.status_code == 201
    assert response.json()["user"]["role"] == USER_ROLE_USER
    user = db_session.scalar(select(User).where(User.email == VALID_PAYLOAD["email"]))
    assert user.role == USER_ROLE_USER


def test_register_creates_personal_space(client: TestClient, db_session: Session) -> None:
    """회원가입 트랜잭션 안에서 개인 스페이스와 owner 멤버십이 함께 생겨야 한다."""
    register(client)

    user = db_session.scalar(select(User).where(User.email == VALID_PAYLOAD["email"]))
    assert user is not None

    space = db_session.scalar(select(Space).where(Space.owner_id == user.id))
    assert space is not None
    assert space.type == SPACE_TYPE_PERSONAL
    assert space.name == PERSONAL_SPACE_DEFAULT_NAME
    # 개인 스페이스는 초대가 불가능하므로 참여 번호가 없어야 한다.
    assert space.join_code is None
    assert space.uuid is not None

    member = db_session.scalar(select(SpaceMember).where(SpaceMember.space_id == space.id))
    assert member is not None
    assert member.role == SPACE_ROLE_OWNER
    assert member.status == SPACE_MEMBER_STATUS_ACTIVE

    # 앱 실행 시 열 스페이스가 개인 스페이스로 지정돼 있어야 한다.
    assert user.default_space_id == space.id


def test_register_duplicate_email(client: TestClient) -> None:
    register(client)
    response = register(client, nickname="다른닉네임")

    assert response.status_code == 409
    assert response.json()["code"] == "EMAIL_ALREADY_EXISTS"
    assert response.json()["field"] == "email"


def test_register_duplicate_nickname(client: TestClient) -> None:
    register(client)
    response = register(client, email="other@example.com")

    assert response.status_code == 409
    assert response.json()["code"] == "NICKNAME_ALREADY_EXISTS"
    assert response.json()["field"] == "nickname"


def test_register_short_password(client: TestClient) -> None:
    """길이 미달 오류도 한국어 문구로 나가야 한다.

    길이 검사를 Field(min_length=...)에 맡기면 pydantic이 "String should have at
    least 9 characters"라는 영어 문구를 응답에 실어 보낸다. API_SPEC 2.5절은
    message를 화면에 그대로 노출한다고 정의했으므로 여기서 한국어인지 못박는다.
    """
    response = register(client, password="Abcde1!x")

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert response.json()["field"] == "password"
    assert response.json()["message"] == "비밀번호는 9자 이상이어야 합니다."


def test_register_password_requires_english_number_and_special_character(client: TestClient) -> None:
    # 순서대로 영문 없음 / 숫자 없음 / 특수문자 없음. 마지막 둘은 공백과 한글이
    # 각각 특수문자·영문으로 인정되지 않는다는 것까지 확인한다.
    invalid_passwords = ("12345678!", "Password!", "Password1", "Password 1234", "비밀번호가나다1!")

    for password in invalid_passwords:
        response = register(client, password=password)

        assert response.status_code == 422
        assert response.json()["code"] == "VALIDATION_ERROR"
        assert response.json()["field"] == "password"
        assert response.json()["message"] == "비밀번호는 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다."


def test_register_password_allows_korean_mixed_with_english(client: TestClient) -> None:
    """한글만 쓰는 건 막지만, 영문·숫자·특수문자를 갖췄다면 한글이 섞여도 가입된다."""
    response = register(client, password="비밀번호Abc1!")

    assert response.status_code == 201


def test_register_password_over_bcrypt_byte_limit(client: TestClient) -> None:
    """한글 비밀번호는 글자 수가 적어도 바이트 수가 커서 bcrypt 한계를 넘을 수 있다.

    이 검증이 없으면 해싱 단계에서 터져 500이 난다.
    """
    # 한글 1자 = UTF-8 3바이트. 25자 = 75바이트로 72바이트 한계를 넘는다.
    response = register(client, password="가" * 25)

    assert response.status_code == 422
    assert response.json()["field"] == "password"
    # 이 값은 구성 규칙(영문·숫자·특수문자)도 함께 어기지만, 바이트 검사를 먼저 하므로
    # 길이 안내가 나가야 한다. API_SPEC 3.2절에 명시한 검사 순서와 같다.
    assert response.json()["message"] == "비밀번호가 너무 깁니다. 조금 짧게 입력해 주세요."


def test_register_invalid_email(client: TestClient) -> None:
    response = register(client, email="not-an-email")

    assert response.status_code == 422
    assert response.json()["field"] == "email"


# ── 로그인 ────────────────────────────────────────


def test_login_success(client: TestClient) -> None:
    register(client)
    response = login(client)

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert response.json()["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient) -> None:
    register(client)
    response = login(client, password="wrongpassword")

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_CREDENTIALS"


def test_login_unknown_email_returns_same_error(client: TestClient) -> None:
    """가입되지 않은 이메일과 틀린 비밀번호는 구분되지 않아야 한다.

    응답이 다르면 "이 이메일은 가입되어 있다"는 사실이 새어나간다(계정 열거).
    """
    register(client)
    unknown = login(client, email="nobody@example.com")
    wrong_password = login(client, password="wrongpassword")

    assert unknown.status_code == wrong_password.status_code == 401
    assert unknown.json() == wrong_password.json()


# ── 내 정보 조회 ──────────────────────────────────


def test_me_success(client: TestClient) -> None:
    token = register(client).json()["tokens"]["access_token"]
    response = client.get("/api/v1/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["email"] == VALID_PAYLOAD["email"]
    assert response.json()["default_space_id"] is not None


def test_me_returns_personal_space_uuid(client: TestClient) -> None:
    """default_space_id는 내부 정수 id가 아니라 개인 스페이스의 공개 UUID여야 한다."""
    token = register(client).json()["tokens"]["access_token"]
    headers = auth_header(token)

    me = client.get("/api/v1/auth/me", headers=headers).json()
    spaces = client.get("/api/v1/spaces", headers=headers).json()["spaces"]
    personal = next(space for space in spaces if space["type"] == "personal")

    assert me["default_space_id"] == personal["id"]


def test_default_space_id_is_usable_as_path_parameter(client: TestClient) -> None:
    """받은 값을 그대로 일정 경로에 넣어 부를 수 있어야 한다.

    이 성질이 없으면 클라이언트가 로그인 직후 GET /spaces를 한 번 더 불러 UUID를
    찾아야 한다. 정수 내부 id를 내려주던 시절에 실제로 그랬다.
    """
    token = register(client).json()["tokens"]["access_token"]
    headers = auth_header(token)
    space_id = client.get("/api/v1/auth/me", headers=headers).json()["default_space_id"]

    response = client.get(f"/api/v1/spaces/{space_id}/schedules", headers=headers)

    assert response.status_code == 200
    assert response.json()["items"] == []


def test_me_without_token(client: TestClient) -> None:
    """토큰이 없으면 403이 아니라 401이어야 한다.

    프론트엔드의 토큰 자동 갱신 로직이 401을 신호로 삼기 때문이다.
    """
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"


def test_me_with_invalid_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me", headers=auth_header("garbage-token"))

    assert response.status_code == 401


def test_me_rejects_refresh_token(client: TestClient) -> None:
    """refresh token으로는 일반 API를 호출할 수 없어야 한다."""
    refresh_token = register(client).json()["tokens"]["refresh_token"]
    response = client.get("/api/v1/auth/me", headers=auth_header(refresh_token))

    assert response.status_code == 401


# ── 토큰 재발급 ───────────────────────────────────


def test_refresh_success(client: TestClient) -> None:
    refresh_token = register(client).json()["tokens"]["refresh_token"]
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})

    assert response.status_code == 200
    assert response.json()["access_token"]


def test_refresh_rejects_access_token(client: TestClient) -> None:
    """access token으로 재발급을 시도하는 오용을 막아야 한다."""
    access_token = register(client).json()["tokens"]["access_token"]
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": access_token})

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_REFRESH_TOKEN"


def test_refresh_with_garbage_token(client: TestClient) -> None:
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": "not-a-jwt"})

    assert response.status_code == 401


# ── 로그아웃 ──────────────────────────────────────


def test_logout_requires_auth(client: TestClient) -> None:
    assert client.post("/api/v1/auth/logout").status_code == 401


def test_logout_success(client: TestClient) -> None:
    token = register(client).json()["tokens"]["access_token"]
    response = client.post("/api/v1/auth/logout", headers=auth_header(token))

    assert response.status_code == 204
