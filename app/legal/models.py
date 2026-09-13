"""동의 기록.

**받은 사실을 저장하는 이유**: 「개인정보 보호법」은 동의를 받았다는 것을 입증할 수
있어야 한다고 요구한다. 가입 요청에 체크박스만 두고 값을 버리면, 나중에 "동의한 적
없다"는 주장에 내놓을 것이 없다.

가입 시점의 **문서 개정일을 함께 남긴다.** 약관이 바뀌면 "이 사람이 어느 판본에
동의했는가"를 알아야 재동의를 받을 대상을 고를 수 있다. 판본 없이 날짜만 남기면
문서를 언제 고쳤는지와 대조해야 해서 정확하지 않다.
"""

from datetime import date, datetime

from sqlalchemy import ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# 동의 항목 코드.
#
# 앞의 둘은 app/legal/documents의 문서와 짝이 맞는다. 마지막은 문서가 아니라
# 가입 자격 확인이라 개정일이 없다.
CONSENT_TERMS = "terms-of-service"
CONSENT_PRIVACY = "privacy-policy"
CONSENT_AGE_OVER_14 = "age-over-14"


class UserConsent(Base):
    """사용자가 무엇에, 언제, 어느 판본에 동의했는지."""

    __tablename__ = "nl_user_consents"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 탈퇴해도 계정 행이 남으므로(소프트 삭제) 동의 기록도 함께 남는다. 분쟁은 탈퇴한
    # 뒤에 생기는 경우가 많아, 오히려 그때 필요한 기록이다.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("nl_users.id", ondelete="CASCADE"), nullable=False
    )
    # 위 CONSENT_* 중 하나.
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    # 동의한 문서의 개정일. age-over-14처럼 문서가 없는 항목은 비어 있다.
    document_revision: Mapped[date | None] = mapped_column()
    agreed_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        # "이 사람이 무엇에 동의했나"로 조회한다. 재동의를 받을 대상을 고를 때
        # 코드와 판본으로 거르므로 함께 묶는다.
        Index("ix_nl_user_consents_user_code", "user_id", "code"),
    )
