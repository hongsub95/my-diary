"""보관 기간이 지난 개인정보를 파기한다.

프로젝트 루트에서 실행한다.

    python -m scripts.purge_expired_data --dry-run   # 대상 수만 확인
    python -m scripts.purge_expired_data             # 실제로 파기

**정기적으로 돌려야 한다.** 개인정보 처리방침에 적은 보관 기간은 이 작업이 실제로
실행될 때만 지켜진다. 문서에만 적고 실행하지 않으면 그 자체가 위반이다.
운영 서버에서는 하루 한 번 도는 작업으로 걸어둔다.

처리 내용은 app/users/retention.py에 있다. 요약하면 탈퇴 계정은 개인정보만 덮어쓰고
행은 남기며(남의 기록이 연쇄 삭제되는 것을 막기 위해), 감사 로그는 행을 지운다.
"""

import argparse

# 모델을 전부 불러와야 SQLAlchemy가 관계를 해석할 수 있다. alembic/env.py와 같은 이유다.
from app import models as _models  # noqa: F401
from app.core.database import SessionLocal
from app.users import retention


def main() -> int:
    parser = argparse.ArgumentParser(description="보관 기간이 지난 개인정보를 파기한다.")
    parser.add_argument("--dry-run", action="store_true", help="지우지 않고 대상 수만 센다.")
    parser.add_argument(
        "--account-days",
        type=int,
        default=retention.DELETED_ACCOUNT_RETENTION_DAYS,
        help="탈퇴 계정 보관 기간 (기본 %(default)s일)",
    )
    parser.add_argument(
        "--audit-days",
        type=int,
        default=retention.AUDIT_LOG_RETENTION_DAYS,
        help="접속 기록 보관 기간 (기본 %(default)s일)",
    )
    args = parser.parse_args()

    with SessionLocal() as db:
        if args.dry_run:
            # 실제 파기와 같은 조건을 쓴다. 따로 적으면 미리보기가 실제와 다른 수를
            # 알려주게 된다.
            accounts = len(db.scalars(retention.expired_accounts_query(args.account_days)).all())
            logs = len(db.scalars(retention.expired_audit_logs_query(args.audit_days)).all())
            print(f"파기 예정: 계정 {accounts}건 / 접속 기록 {logs}건")
            return 0

        accounts = retention.anonymize_expired_accounts(db, args.account_days)
        logs = retention.purge_expired_audit_logs(db, args.audit_days)

    print(f"파기 완료: 계정 {accounts}건 / 접속 기록 {logs}건")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
