"""감사 로그(audit log) 모델.

"누가 언제 무엇을 했는가"를 남기는 append-only 테이블이다. 관리자 페이지의 이력 조회,
보안 사고 조사, 개인정보 접근 기록 요구에 대응하기 위한 것이다.

이 기록은 소급 생성이 불가능하다. 나중에 관리자 페이지를 만들 때 과거 이력을 복원할
방법이 없으므로 기능보다 먼저 쌓기 시작해야 한다.
"""

from datetime import datetime

from sqlalchemy import Index, String, func
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditAction:
    """감사 로그에 남기는 행위 코드.

    문자열을 코드 곳곳에 직접 쓰면 오타가 나도 알 수 없고 나중에 목록을 파악하기 어려워
    상수로 모아둔다. 값은 DB에 그대로 저장되므로 한 번 정하면 바꾸지 않는다.
    """

    # 인증
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT = "LOGOUT"
    LOGOUT_ALL = "LOGOUT_ALL"
    REGISTER = "REGISTER"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"

    # 스페이스 (구현 시 사용)
    SPACE_CREATED = "SPACE_CREATED"
    SPACE_UPDATED = "SPACE_UPDATED"
    SPACE_ARCHIVED = "SPACE_ARCHIVED"
    SPACE_JOINED = "SPACE_JOINED"
    SPACE_LEFT = "SPACE_LEFT"
    MEMBER_REMOVED = "MEMBER_REMOVED"
    OWNERSHIP_TRANSFERRED = "OWNERSHIP_TRANSFERRED"
    JOIN_CODE_REGENERATED = "JOIN_CODE_REGENERATED"

    # 일정
    SCHEDULE_CREATED = "SCHEDULE_CREATED"
    SCHEDULE_UPDATED = "SCHEDULE_UPDATED"
    SCHEDULE_DELETED = "SCHEDULE_DELETED"

    # 계정
    ACCOUNT_DELETED = "ACCOUNT_DELETED"


class AuditLog(Base):
    """감사 로그 한 줄. 한 번 기록하면 수정하거나 삭제하지 않는다.

    수정 이력이 없으므로 updated_at을 두지 않는다. 기록을 고칠 수 있으면 감사 로그로서
    의미가 없기 때문이다.
    """

    __tablename__ = "nl_audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)

    # 행위자. 외래키를 걸지 않는 이유:
    # 1) 회원이 탈퇴해도 "누가 했는가"는 남아야 한다. CASCADE면 이력이 함께 지워지고,
    #    SET NULL이면 행위자를 잃는다. 둘 다 감사 로그의 목적에 어긋난다.
    # 2) 로그인 실패처럼 사용자가 특정되지 않는 사건도 기록해야 한다(NULL 허용).
    # 감사 로그는 참조 무결성보다 "그 시점의 사실"을 보존하는 것이 우선이다.
    user_id: Mapped[int | None] = mapped_column()

    # 행위 시점의 계정 스냅샷. 나중에 이메일을 바꾸거나 탈퇴해도 당시 값이 남는다.
    # 로그인 실패 시에는 시도한 이메일이 들어간다.
    actor_email: Mapped[str | None] = mapped_column(String(255))

    action: Mapped[str] = mapped_column(String(50), nullable=False)

    # 대상 리소스. 예: resource_type="space", resource_id=3
    # 스페이스처럼 대상이 없는 행위(로그인 등)는 둘 다 NULL이다.
    resource_type: Mapped[str | None] = mapped_column(String(50))
    resource_id: Mapped[int | None] = mapped_column()

    # 접속 정보. 이상 접속 확인과 침해 사고 조사에 쓴다.
    # INET 타입은 IPv4/IPv6를 모두 담고 대역 검색도 지원한다.
    ip_address: Mapped[str | None] = mapped_column(INET)
    user_agent: Mapped[str | None] = mapped_column(String(500))

    # 행위별로 필요한 추가 정보를 자유롭게 담는다.
    # 예: 실패 사유, 변경 전후 값, 참여 번호 시도 횟수.
    # 컬럼을 미리 다 정의할 수 없어 JSONB를 쓴다. PostgreSQL은 JSONB 내부도 검색할 수 있다.
    detail: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        # "이 사용자가 무엇을 했나" — 관리자 페이지의 사용자 상세 화면.
        # created_at을 내림차순으로 묶어 최신순 정렬까지 인덱스로 처리한다.
        Index("ix_nl_audit_logs_user_created", "user_id", created_at.desc()),
        # "로그인 실패 목록" 처럼 특정 행위를 기간으로 훑을 때.
        Index("ix_nl_audit_logs_action_created", "action", created_at.desc()),
        # "이 스페이스에 무슨 일이 있었나".
        Index("ix_nl_audit_logs_resource", "resource_type", "resource_id"),
        # 무차별 대입 탐지: 같은 IP에서 짧은 시간에 실패가 몰리는지 확인할 때.
        Index("ix_nl_audit_logs_ip_created", "ip_address", created_at.desc()),
    )
