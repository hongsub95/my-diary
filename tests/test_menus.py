"""메뉴 API 테스트.

테스트 DB는 마이그레이션이 아니라 모델 메타데이터로 만들기 때문에, 마이그레이션에
담긴 시드 데이터가 들어오지 않는다. 그래서 각 테스트가 필요한 메뉴를 직접 만든다.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.menus.models import MENU_SCOPE_ADMIN, MENU_SCOPE_APP, Menu
from app.users.models import USER_ROLE_MASTER, User

REGISTER_PAYLOAD = {
    "email": "menu@example.com",
    "nickname": "메뉴테스트",
    "password": "Password1234!",
    # 가입 조건이라 셋 다 True여야 통과한다 (app/auth/schemas.py).
    "agreed_terms": True,
    "agreed_privacy": True,
    "is_over_14": True,
}


@pytest.fixture
def app_menus(db_session: Session) -> None:
    """운영에서 쓰는 앱 하단 탭 3개를 만든다 (마이그레이션 시드와 동일한 구성)."""
    db_session.add_all(
        [
            Menu(code="calendar", scope=MENU_SCOPE_APP, name="캘린더", icon="calendar", path="/calendar", sort_order=1),
            Menu(code="schedules", scope=MENU_SCOPE_APP, name="일정", icon="list", path="/schedules", sort_order=2),
            Menu(code="settings", scope=MENU_SCOPE_APP, name="설정", icon="settings", path="/settings", sort_order=3),
        ]
    )
    db_session.commit()


def auth_header(client: TestClient) -> dict[str, str]:
    """회원가입 후 인증 헤더를 만든다. 가입 계정은 항상 일반 회원(role=1)이다."""
    token = client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD).json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def master_auth_header(client: TestClient, db_session: Session) -> dict[str, str]:
    """마스터 권한(role=0)으로 승격한 계정의 인증 헤더를 만든다.

    회원가입 API로는 마스터를 만들 수 없으므로(항상 일반 회원으로 생성된다)
    가입 후 DB에서 직접 등급을 올린다. 운영에서는 마이그레이션이 이 역할을 한다.
    """
    header = auth_header(client)
    user = db_session.query(User).filter(User.email == REGISTER_PAYLOAD["email"]).one()
    user.role = USER_ROLE_MASTER
    db_session.commit()
    return header


# ── 기본 조회 ─────────────────────────────────────


def test_list_app_menus(client: TestClient, app_menus: None) -> None:
    response = client.get("/api/v1/menus", headers=auth_header(client))

    assert response.status_code == 200
    menus = response.json()["menus"]
    assert [m["code"] for m in menus] == ["calendar", "schedules", "settings"]
    assert menus[0]["name"] == "캘린더"
    assert menus[0]["path"] == "/calendar"
    assert menus[0]["icon"] == "calendar"


def test_menus_require_auth(client: TestClient, app_menus: None) -> None:
    assert client.get("/api/v1/menus").status_code == 401


def test_menus_are_sorted_by_sort_order(client: TestClient, db_session: Session) -> None:
    """sort_order 순서대로 나와야 한다. 삽입 순서와 무관해야 한다."""
    db_session.add_all(
        [
            Menu(code="third", scope=MENU_SCOPE_APP, name="셋째", sort_order=3),
            Menu(code="first", scope=MENU_SCOPE_APP, name="첫째", sort_order=1),
            Menu(code="second", scope=MENU_SCOPE_APP, name="둘째", sort_order=2),
        ]
    )
    db_session.commit()

    menus = client.get("/api/v1/menus", headers=auth_header(client)).json()["menus"]

    assert [m["code"] for m in menus] == ["first", "second", "third"]


# ── 노출 제어 ─────────────────────────────────────


def test_inactive_menu_is_hidden(client: TestClient, db_session: Session) -> None:
    """비활성 메뉴는 응답에 포함되지 않아야 한다.

    프론트엔드가 필터링하지 않고 받은 그대로 그릴 수 있어야 한다.
    """
    db_session.add_all(
        [
            Menu(code="visible", scope=MENU_SCOPE_APP, name="보임", sort_order=1),
            Menu(code="hidden", scope=MENU_SCOPE_APP, name="숨김", sort_order=2, is_active=False),
        ]
    )
    db_session.commit()

    menus = client.get("/api/v1/menus", headers=auth_header(client)).json()["menus"]

    assert [m["code"] for m in menus] == ["visible"]


def test_scope_separates_app_and_admin(client: TestClient, db_session: Session) -> None:
    """앱 메뉴 조회에 관리자 메뉴가 섞이면 안 된다."""
    db_session.add_all(
        [
            Menu(code="app_tab", scope=MENU_SCOPE_APP, name="앱탭", sort_order=1),
            Menu(code="admin_dash", scope=MENU_SCOPE_ADMIN, name="대시보드", sort_order=1),
        ]
    )
    db_session.commit()
    headers = auth_header(client)

    app_menus = client.get("/api/v1/menus?scope=app", headers=headers).json()["menus"]
    admin_menus = client.get("/api/v1/menus?scope=admin", headers=headers).json()["menus"]

    assert [m["code"] for m in app_menus] == ["app_tab"]
    assert [m["code"] for m in admin_menus] == ["admin_dash"]


def test_invalid_scope_is_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/menus?scope=hacker", headers=auth_header(client))

    assert response.status_code == 422


# ── 계층 구조 ─────────────────────────────────────


def test_child_menus_are_nested(client: TestClient, db_session: Session) -> None:
    """하위 메뉴는 부모의 children에 중첩되어야 한다."""
    parent = Menu(code="admin_users", scope=MENU_SCOPE_ADMIN, name="사용자 관리", sort_order=1)
    db_session.add(parent)
    db_session.flush()
    db_session.add_all(
        [
            Menu(code="admin_user_list", scope=MENU_SCOPE_ADMIN, name="목록", parent_id=parent.id, sort_order=1),
            Menu(code="admin_user_logs", scope=MENU_SCOPE_ADMIN, name="접속 이력", parent_id=parent.id, sort_order=2),
        ]
    )
    db_session.commit()

    menus = client.get("/api/v1/menus?scope=admin", headers=auth_header(client)).json()["menus"]

    # 자식은 최상위 목록에 중복해서 나오면 안 된다.
    assert len(menus) == 1
    assert menus[0]["code"] == "admin_users"
    assert [c["code"] for c in menus[0]["children"]] == ["admin_user_list", "admin_user_logs"]


def test_leaf_menu_has_empty_children(client: TestClient, app_menus: None) -> None:
    """하위 메뉴가 없어도 children은 null이 아니라 빈 배열이어야 한다.

    클라이언트가 존재 여부를 확인하지 않고 바로 순회할 수 있게 하기 위함이다.
    """
    menus = client.get("/api/v1/menus", headers=auth_header(client)).json()["menus"]

    assert menus[0]["children"] == []


# ── 권한 ──────────────────────────────────────────


def _admin_menus(db_session: Session) -> None:
    """제한 없는 메뉴 하나와 마스터 전용 메뉴 하나를 만든다."""
    db_session.add_all(
        [
            Menu(code="admin_open", scope=MENU_SCOPE_ADMIN, name="공개", sort_order=1),
            Menu(
                code="admin_secret",
                scope=MENU_SCOPE_ADMIN,
                name="마스터 전용",
                sort_order=2,
                required_role=USER_ROLE_MASTER,
            ),
        ]
    )
    db_session.commit()


def test_role_restricted_menu_is_hidden_without_role(
    client: TestClient, db_session: Session
) -> None:
    """권한이 필요한 메뉴는 권한 없는 사용자에게 보이면 안 된다."""
    _admin_menus(db_session)

    menus = client.get("/api/v1/menus?scope=admin", headers=auth_header(client)).json()["menus"]

    assert [m["code"] for m in menus] == ["admin_open"]


def test_role_restricted_menu_is_visible_to_master(
    client: TestClient, db_session: Session
) -> None:
    """등급이 일치하면 제한 메뉴가 보여야 한다.

    required_role과 users.role의 타입이 어긋나면(문자열 vs 정수) 이 비교가 영원히
    False가 되어 관리자 메뉴가 아무에게도 안 보인다. 그 회귀를 잡는 테스트다.
    """
    _admin_menus(db_session)
    headers = master_auth_header(client, db_session)

    menus = client.get("/api/v1/menus?scope=admin", headers=headers).json()["menus"]

    assert [m["code"] for m in menus] == ["admin_open", "admin_secret"]


def test_child_is_hidden_when_parent_is_restricted(
    client: TestClient, db_session: Session
) -> None:
    """부모가 권한으로 걸러지면 자식도 함께 감춰져야 한다.

    자식만 남으면 최상위에 붕 뜬 항목이 생겨 메뉴 구조가 깨진다.
    """
    parent = Menu(
        code="admin_secret",
        scope=MENU_SCOPE_ADMIN,
        name="마스터 전용",
        sort_order=1,
        required_role=USER_ROLE_MASTER,
    )
    db_session.add(parent)
    db_session.flush()
    db_session.add(
        Menu(code="admin_secret_sub", scope=MENU_SCOPE_ADMIN, name="하위", parent_id=parent.id, sort_order=1)
    )
    db_session.commit()

    menus = client.get("/api/v1/menus?scope=admin", headers=auth_header(client)).json()["menus"]

    assert menus == []
