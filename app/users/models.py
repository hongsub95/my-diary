from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# 계정 권한 등급.
#
# 크기를 비교하는 '등급 사다리'가 아니라 **서로 구분되는 코드 값**으로 다룬다.
# 0(마스터)과 1(일반) 사이에는 정수 자리가 없어서, 나중에 운영 스태프 같은 중간 등급이
# 필요해지면 2, 3처럼 뒤에 붙이고 아래 표에 뜻을 적는 방식으로 늘린다. 이렇게 해야
# 등급을 추가할 때 기존 행의 값을 다시 매기지 않아도 된다.
#
# | 값 | 뜻 |
# |---|---|
# | 0 | 마스터. 운영자가 직접 쓰는 계정 |
# | 1 | 일반 회원. 회원가입으로 만들어지는 모든 계정의 기본값 |
USER_ROLE_MASTER = 0
USER_ROLE_USER = 1


class User(Base):
    """회원 계정 테이블. 이메일/비밀번호 로그인과 닉네임 표시를 위한 기본 프로필을 담는다."""

    __tablename__ = "nl_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    # 평문 비밀번호는 저장하지 않고 bcrypt 해시만 저장한다 (app/auth/security.py에서 생성).
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    # 권한 등급. 위 USER_ROLE_* 표 참고.
    # server_default를 두는 이유: 회원가입 코드가 role을 지정하지 않아도 DB가 일반 회원으로
    # 채워주고, 이미 쌓여 있던 행도 마이그레이션 시점에 같은 값으로 메워지기 때문이다.
    # CHECK 제약은 일부러 걸지 않았다. 등급이 늘 때마다 마이그레이션을 새로 만들어야 해서다.
    role: Mapped[int] = mapped_column(nullable=False, server_default=str(USER_ROLE_USER))
    # 앱 실행 시 열리는 스페이스. 회원가입 때 개인 스페이스로 설정되고, 이후 사용자가
    # 직접 바꿀 수 있다. 현재 기본값으로 지정된 스페이스는 삭제할 수 없다 (명세 0절).
    # spaces.owner_id -> users.id 순환 참조가 생기므로 FK 제약은 마이그레이션에서 use_alter로 처리한다.
    default_space_id: Mapped[int | None] = mapped_column(
        ForeignKey("nl_spaces.id", ondelete="SET NULL", use_alter=True, name="fk_users_default_space")
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # 앱을 열 때마다 기본 스페이스를 찾고, 스페이스 삭제 시 이를 기본값으로
        # 지정한 사용자가 있는지 확인해야 하므로 인덱스를 둔다.
        Index("ix_nl_users_default_space_id", "default_space_id"),
    )

    # created_schedules: 내가 만든 일정. 접근 권한은 이걸로 판단하지 않고 SpaceMember로 판단한다.
    created_schedules: Mapped[list["Schedule"]] = relationship(
        back_populates="created_by_user", foreign_keys="Schedule.created_by", passive_deletes=True
    )
    space_memberships: Mapped[list["SpaceMember"]] = relationship(back_populates="user", passive_deletes=True)

    # 기본 스페이스를 응답에 공개 UUID로 내보내려면 스페이스 행 자체가 필요하다.
    # users와 spaces 사이에는 서로를 가리키는 외래키가 둘(여기와 spaces.owner_id) 있어서
    # 어느 쪽으로 잇는지 foreign_keys로 명시해야 SQLAlchemy가 경로를 고르지 못해 실패하지 않는다.
    # lazy는 기본값(select)으로 둔다. 인증된 요청마다 User를 읽는데 여기서 항상 조인하면
    # 스페이스를 쓰지 않는 대부분의 요청에까지 비용이 붙는다.
    default_space: Mapped["Space | None"] = relationship(foreign_keys=[default_space_id])
