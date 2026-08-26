"""메뉴 모델.

화면에 표시되는 메뉴를 DB로 관리한다. 코드를 고치고 배포하지 않아도 메뉴 이름·순서·
노출 여부를 바꿀 수 있게 하기 위한 것이다.

관리 대상 (2026-08-03 결정):

- `app`   : 앱 하단 탭 (현재 홈 / 캘린더 / 일정 / 더보기, 목표는 기록 포함 5탭)
- `admin` : 관리자 페이지 메뉴. 권한별로 보이는 항목이 달라 DB 관리가 특히 유용하다

설정 화면 내부 메뉴(프로필 수정, 약관 등)는 DB로 관리하지 않고 프론트엔드에 둔다.
항목마다 동작이 제각각이라 DB에 담아도 얻는 것이 적기 때문이다.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# 메뉴가 속한 화면 영역.
MENU_SCOPE_APP = "app"
MENU_SCOPE_ADMIN = "admin"

# 메뉴 노출 권한은 nl_users.role과 같은 정수 코드를 쓴다 (app/users/models.py의 USER_ROLE_*).
# 문자열('admin')로 두면 int인 users.role과 절대 같아지지 않아 관리자 메뉴가
# 아무에게도 안 보이는 상태가 된다.


class Menu(Base):
    """메뉴 항목 하나.

    parent_id로 자기 자신을 참조해 계층을 만든다. 앱 하단 탭은 1단계로만 쓰고,
    관리자 메뉴는 대분류 아래 소분류를 두는 2단계 구조를 상정한다.
    """

    __tablename__ = "nl_menus"

    id: Mapped[int] = mapped_column(primary_key=True)

    # 프로그램이 특정 메뉴를 찾을 때 쓰는 불변 식별자 (예: "calendar", "admin_users").
    # 표시 이름(name)은 운영 중에 바뀔 수 있으므로 코드에서는 이 값으로 참조한다.
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    scope: Mapped[str] = mapped_column(String(20), nullable=False, server_default=MENU_SCOPE_APP)

    # 화면에 보이는 이름. 운영 중 변경 가능한 값이다.
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    # 아이콘 식별자. 프론트엔드가 이 값으로 아이콘 컴포넌트를 고른다.
    # 이미지 경로가 아니라 이름을 저장해야 웹·앱이 각자 형식(svg/png)을 쓸 수 있다.
    icon: Mapped[str | None] = mapped_column(String(50))

    # 클릭 시 이동할 프론트엔드 라우트. 하위 메뉴를 펼치기만 하는 항목은 NULL이다.
    path: Mapped[str | None] = mapped_column(String(200))

    # 상위 메뉴. NULL이면 최상위다.
    # 부모가 지워지면 자식도 함께 사라져야 하므로 CASCADE로 둔다.
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("nl_menus.id", ondelete="CASCADE"))

    # 같은 부모 아래에서의 표시 순서. 작을수록 먼저 나온다.
    sort_order: Mapped[int] = mapped_column(nullable=False, server_default="0")

    # 메뉴를 지우지 않고 잠시 감출 때 쓴다. 삭제하면 이 메뉴를 참조하던 설정이나
    # 통계가 함께 사라지므로, 운영 중에는 삭제보다 비활성화를 쓴다.
    is_active: Mapped[bool] = mapped_column(nullable=False, server_default="true")

    # 이 메뉴를 보려면 필요한 권한 등급. NULL이면 제한 없음.
    # nl_users.role과 값을 정확히 대조한다(예: 0을 넣으면 마스터에게만 보인다).
    required_role: Mapped[int | None] = mapped_column()

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            f"scope IN ('{MENU_SCOPE_APP}', '{MENU_SCOPE_ADMIN}')", name="ck_menus_scope"
        ),
        # 메뉴 조회는 "이 영역의 활성 메뉴를 순서대로"가 전부다. 세 컬럼을 묶어
        # 필터와 정렬을 한 번에 처리한다.
        Index("ix_nl_menus_scope_active_order", "scope", "is_active", "sort_order"),
        # 하위 메뉴를 찾을 때와 부모 삭제 시 자식을 정리할 때 쓴다.
        Index("ix_nl_menus_parent_id", "parent_id"),
    )

    # 자기 참조 관계. remote_side로 "어느 쪽이 부모인지"를 알려줘야 SQLAlchemy가
    # 같은 테이블 안의 두 방향을 구분할 수 있다.
    parent: Mapped["Menu | None"] = relationship(
        back_populates="children", remote_side=[id]
    )
    children: Mapped[list["Menu"]] = relationship(
        back_populates="parent", order_by="Menu.sort_order", passive_deletes=True
    )
