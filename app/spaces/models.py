"""스페이스(Space) 도메인 모델.

스페이스는 일정·장소·일기·사진이 저장되는 최상위 컨테이너다. 모든 Schedule은 반드시
정확히 하나의 스페이스에 속하고, 접근 권한은 "일정의 작성자인가"가 아니라
"그 스페이스의 활성 멤버인가"로 판단한다. 상세 정책은 docs/SPACE_MODEL_SPEC.md 참고.
"""

import secrets
import uuid as uuid_module
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# 회원가입 시 자동 생성되는 개인 스페이스의 기본 표시 이름 (SPACE_MODEL_SPEC 4.2).
# 2026-10-05 화면 명칭을 "공간"으로 확정하면서 "나의 일정"에서 바꿨다
# (docs/SPACE_COLLABORATION_UI_SPEC.md '화면 명칭과 문구'). 새로 가입하는 사람부터 적용된다.
# 이미 만들어진 공간의 이름은 바꾸지 않는다 — 사용자가 고쳐 쓴 이름일 수도 있고, 바뀌면
# 자기 공간이 사라진 것처럼 보인다.
PERSONAL_SPACE_DEFAULT_NAME = "나만의 공간"

# 참여 번호에 쓸 문자 집합. 사용자가 눈으로 보고 옮겨 적기 때문에 서로 헷갈리는
# 0/O, 1/I/L은 제외한다 (명세 0절).
JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
JOIN_CODE_LENGTH = 8


def generate_join_code() -> str:
    """공유 스페이스에 들어올 때 입력하는 참여 번호를 만든다.

    추측으로 남의 스페이스에 들어가지 못하도록 secrets(암호학적 난수)를 쓴다.
    random 모듈은 예측 가능하므로 쓰지 않는다.

    :return: 혼동 문자를 제외한 8자리 대문자/숫자 조합
    """
    return "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(JOIN_CODE_LENGTH))

SPACE_TYPE_PERSONAL = "personal"
SPACE_TYPE_SHARED = "shared"

SPACE_ROLE_OWNER = "owner"
SPACE_ROLE_MEMBER = "member"

SPACE_MEMBER_STATUS_ACTIVE = "active"
SPACE_MEMBER_STATUS_LEFT = "left"
SPACE_MEMBER_STATUS_REMOVED = "removed"

# 공유 스페이스 최대 멤버 수 (명세 16절 권장값).
# 운영 중 조정할 수 있도록 상수로 둔다.
SHARED_SPACE_MAX_MEMBERS = 20


class Space(Base):
    """일정 기록이 쌓이는 공간. personal은 회원가입 시 1개 자동 생성되며 초대할 수 없고,
    shared는 사용자가 직접 만들어 참여 번호로 다른 사람을 받는다."""

    __tablename__ = "nl_spaces"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 외부(URL, 클라이언트)에 노출하는 식별자. 정수 id를 그대로 쓰면 남의 스페이스 번호를
    # 순서대로 찍어보는 시도가 가능하므로 추측 불가능한 UUID를 따로 둔다.
    uuid: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, server_default=func.gen_random_uuid()
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False, server_default=SPACE_TYPE_PERSONAL)
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50))
    # 사용자가 입력해서 들어오는 참여 번호. 개인 스페이스는 초대 자체가 불가능하므로 NULL이다.
    # 유출 시 owner가 재발급할 수 있어야 하므로 불변값으로 다루지 않는다.
    join_code: Mapped[str | None] = mapped_column(String(16), unique=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("nl_users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
    # 소프트 삭제(보관). 값이 있으면 목록에서 감추되 기록은 남긴다 (명세 7.4).
    archived_at: Mapped[datetime | None] = mapped_column()

    __table_args__ = (
        CheckConstraint(f"type IN ('{SPACE_TYPE_PERSONAL}', '{SPACE_TYPE_SHARED}')", name="ck_spaces_type"),
        # 개인 스페이스에 참여 번호가 생기면 남을 초대할 수 있게 되므로 DB에서 막는다.
        CheckConstraint(
            f"(type = '{SPACE_TYPE_PERSONAL}' AND join_code IS NULL) OR type = '{SPACE_TYPE_SHARED}'",
            name="ck_spaces_personal_has_no_join_code",
        ),
        # 사용자 탈퇴 시 그가 소유한 스페이스를 찾을 때 쓴다.
        Index("ix_nl_spaces_owner_id", "owner_id"),
    )

    members: Mapped[list["SpaceMember"]] = relationship(back_populates="space", passive_deletes=True)
    schedules: Mapped[list["Schedule"]] = relationship(back_populates="space", passive_deletes=True)


class SpaceMember(Base):
    """스페이스에 속한 사용자와 그 권한. 모든 보호 API는 이 테이블에 status='active'인
    행이 있는지로 접근 여부를 판단한다 (명세 11절)."""

    __tablename__ = "nl_space_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    space_id: Mapped[int] = mapped_column(ForeignKey("nl_spaces.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("nl_users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default=SPACE_ROLE_MEMBER)
    # 나가거나 제거돼도 행을 지우지 않고 상태만 바꾼다. 과거 기록의 작성자 표시를 위해서다.
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=SPACE_MEMBER_STATUS_ACTIVE)
    joined_at: Mapped[datetime] = mapped_column(server_default=func.now())
    left_at: Mapped[datetime | None] = mapped_column()

    __table_args__ = (
        CheckConstraint(f"role IN ('{SPACE_ROLE_OWNER}', '{SPACE_ROLE_MEMBER}')", name="ck_space_members_role"),
        CheckConstraint("status IN ('active', 'left', 'removed')", name="ck_space_members_status"),
        # 같은 사람이 같은 스페이스에 두 번 들어가지 못하게 막는다. 초대 동시 수락 시
        # 중복 멤버십이 생기는 것을 DB 레벨에서 차단한다 (명세 12절 엣지 케이스).
        UniqueConstraint("space_id", "user_id", name="uq_space_members_space_user"),
        # "내가 속한 스페이스 목록"은 앱을 열 때마다 호출되는 핵심 질의다.
        # 위 고유 제약은 space_id로 시작해서 user_id 단독 조회를 커버하지 못하므로 따로 만든다.
        # status를 함께 묶어 활성 멤버십만 거르는 조건까지 인덱스로 처리한다.
        Index("ix_nl_space_members_user_status", "user_id", "status"),
    )

    space: Mapped["Space"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="space_memberships")
