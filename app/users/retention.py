"""보관 기간이 지난 개인정보 파기.

처리방침에 적은 보관 기간을 실제로 지키는 코드다. 문서에만 적고 실행하지 않으면
그 자체가 위반이다.

**두 가지를 다르게 다룬다.**

| 대상 | 처리 | 이유 |
|---|---|---|
| 탈퇴 계정 | 개인정보만 덮어쓰고 행은 남긴다 | 행을 지우면 남의 기록까지 사라진다 (아래) |
| 감사 로그 | 행을 지운다 | 외래키가 없어 딸린 것이 없다 |

**왜 탈퇴 계정 행을 지우지 않는가.** `nl_users.id`를 가리키는 외래키가 전부
`ondelete="CASCADE"`라, 행 하나를 지우면 그 사람이 만든 일정과 스페이스가 통째로
사라지고 거기 달린 **다른 사람의 일기·사진까지** 연쇄 삭제된다. 약관 제7조 4항이
"탈퇴해도 그가 남긴 콘텐츠는 스페이스에 남는다"고 약속한 것과 정면으로 어긋난다.

개인정보 보호법이 요구하는 것은 **개인정보의 파기**이지 행의 삭제가 아니다. 사람을
알아볼 수 있는 값(이메일·닉네임·비밀번호 해시)을 되돌릴 수 없게 덮어쓰면 목적은
달성되고, 남은 행은 "탈퇴한 사용자"라는 표시로만 쓰인다.
"""

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.audit.models import AuditLog
from app.users.models import USER_NOT_IN_USE, User

# 탈퇴 계정의 개인정보 보관 기간.
#
# 이 기간 동안은 같은 이메일·닉네임으로 다시 가입할 수 없다. 되돌리기 어려운 탈퇴에
# 대한 문의와 분쟁이 대체로 이 안에 들어온다. 기간이 지나면 파기되고, 그때부터는
# 같은 이메일로 다시 가입할 수 있다.
DELETED_ACCOUNT_RETENTION_DAYS = 90

# 접속 기록 보관 기간. 「통신비밀보호법」이 요구하는 3개월에 맞춘다.
AUDIT_LOG_RETENTION_DAYS = 90

# 파기한 계정의 표시 이름. 뒤에 id를 붙여 유니크 제약을 피한다.
ANONYMIZED_NICKNAME = "탈퇴한 사용자"
# 실제로 존재할 수 없는 도메인을 쓴다. 파기한 주소로 메일이 나가는 사고를 막는다.
ANONYMIZED_EMAIL_DOMAIN = "deleted.invalid"


def _cutoff(days: int) -> datetime:
    """지금으로부터 days일 전 시각."""
    return datetime.now(timezone.utc) - timedelta(days=days)


def expired_accounts_query(days: int = DELETED_ACCOUNT_RETENTION_DAYS):
    """파기 대상 계정을 고르는 조건.

    :param days: 보관 기간
    :return: User를 고르는 select 문

    실제 파기와 미리보기(scripts/purge_expired_data.py --dry-run)가 이 하나를 함께
    쓴다. 조건을 양쪽에 따로 적으면 한쪽만 고쳐져, 미리보기가 실제와 다른 수를
    알려주는 상태가 된다.
    """
    return select(User).where(
        User.use == USER_NOT_IN_USE,
        User.deleted_at.is_not(None),
        User.deleted_at < _cutoff(days),
        # 이미 파기한 계정은 건너뛴다. 그래서 여러 번 돌려도 안전하다.
        User.email.not_like(f"%@{ANONYMIZED_EMAIL_DOMAIN}"),
    )


def expired_audit_logs_query(days: int = AUDIT_LOG_RETENTION_DAYS):
    """파기 대상 접속 기록을 고르는 조건. 위와 같은 이유로 한 곳에 둔다."""
    return select(AuditLog.id).where(AuditLog.created_at < _cutoff(days))


def anonymize_expired_accounts(db: Session, days: int = DELETED_ACCOUNT_RETENTION_DAYS) -> int:
    """보관 기간이 지난 탈퇴 계정의 개인정보를 지운다.

    :param days: 보관 기간
    :return: 파기한 계정 수

    **여러 번 돌려도 안전하다.** 이미 파기한 계정은 이메일이 파기용 도메인으로 바뀌어
    있어 다시 걸리지 않는다.

    비밀번호 해시도 덮어쓴다. 원래 해시를 남겨두면 다른 곳에서 같은 비밀번호를 쓰는
    사람의 자료가 계속 남아 있는 셈이고, 파기했다고 말할 수 없다.
    """
    expired = db.scalars(expired_accounts_query(days)).all()

    for user in expired:
        # id를 붙여 유니크 제약을 지킨다. 원래 값은 복구할 수 없다.
        user.email = f"deleted-{user.id}@{ANONYMIZED_EMAIL_DOMAIN}"
        user.nickname = f"{ANONYMIZED_NICKNAME}{user.id}"
        # 검증에 절대 통과하지 않는 값으로 덮는다. 빈 문자열로 두면 해시 검사 함수가
        # 형식 오류를 내며 터질 수 있어, 길이가 있는 무작위 값을 넣는다.
        user.password_hash = secrets.token_hex(32)

    db.commit()
    return len(expired)


def purge_expired_audit_logs(db: Session, days: int = AUDIT_LOG_RETENTION_DAYS) -> int:
    """보관 기간이 지난 접속 기록을 지운다.

    :param days: 보관 기간
    :return: 지운 행 수

    감사 로그는 `user_id`에 외래키가 없어서(app/audit/models.py) 딸려 지워지는 것이
    없다. 그래서 계정과 달리 행을 그대로 지운다.
    """
    result = db.execute(delete(AuditLog).where(AuditLog.created_at < _cutoff(days)))
    db.commit()
    return result.rowcount or 0
