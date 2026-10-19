"""보관 기간이 지난 보관(삭제)된 스페이스 파기.

스페이스를 지우면 바로 없애지 않고 `archived_at`만 기록한다(소프트 삭제). 보관된 스페이스는
owner를 포함해 누구도 열 수 없고(app/spaces/dependencies.get_active_membership), 앱에
되살리는 기능도 없다. 그래서 보관은 운영자가 복구할 여지를 두는 것일 뿐이고, 기간이
지나면 **스페이스 행과 그 안의 모든 것을 실제로 지운다**(2026-10-19 결정, 일정과 같은 90일).

**스페이스가 보관되는 두 길.**

- owner가 공유 스페이스를 지울 때 (spaces/service.archive_space)
- owner가 탈퇴할 때. 개인 스페이스와 소유한 공유 스페이스가 모두 보관된다
  (users/service.withdraw). 그래서 이 파기는 "탈퇴 90일 뒤 그 사람의 개인 공간 기록도
  사라진다"는 뜻이기도 하다. 처리방침 3.1의 "해당 공간이 유지되는 동안 남는다"와 맞다.

**무엇이 함께 지워지나.** 스페이스 행을 지우면 외래키 CASCADE로 그 안의 일정·멤버십이,
일정의 CASCADE로 장소·일기·사진·타임라인 행이 지워진다. 사용자의 기본 스페이스는
SET NULL이라 남아 있어도 오류가 나지 않는다(보관 시점에 이미 개인 스페이스로 되돌려 둔다).

**사진 파일은 DB 밖이라 직접 지운다.** 일정 파기와 같은 이유로 **파일 먼저, 행 나중**이다
(app/schedules/retention.py 참고). 파일 삭제가 실패해도 행이 남아 다음 실행에서 다시 시도된다.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.storage import FileStorage, get_storage
from app.diaries.models import DiaryPhoto
from app.schedules.models import Schedule
from app.schedules.retention import delete_photo_files
from app.spaces.models import Space

# 보관된 스페이스의 보관 기간. 지운 일정·탈퇴 계정과 같은 90일이다.
ARCHIVED_SPACE_RETENTION_DAYS = 90


def expired_spaces_query(days: int = ARCHIVED_SPACE_RETENTION_DAYS):
    """파기 대상 스페이스 id를 고르는 조건.

    :param days: 보관 기간
    :return: Space.id를 고르는 select 문

    실제 파기와 미리보기(scripts/purge_expired_data.py --dry-run)가 이 하나를 함께 쓴다.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return select(Space.id).where(Space.archived_at.is_not(None), Space.archived_at < cutoff)


def purge_expired_spaces(
    db: Session,
    days: int = ARCHIVED_SPACE_RETENTION_DAYS,
    storage: FileStorage | None = None,
) -> int:
    """보관 기간이 지난 스페이스를 그 안의 일정·기록·사진 파일과 함께 파기한다.

    :param days: 보관 기간
    :param storage: 사진 저장소. 생략하면 설정의 저장소(로컬/S3)를 쓴다
    :return: 파기한 스페이스 수

    스페이스 하나씩 "그 안 모든 일정의 사진 파일 삭제 → 스페이스 행 삭제 → 커밋"을 끝내고
    다음으로 넘어간다. 그 안의 일정은 지운 것(use=0)이든 아니든 모두 대상이다. 중간에 저장소
    오류가 나면 거기서 멈추고 예외를 올린다. **여러 번 돌려도 안전하다.**
    """
    storage = storage or get_storage()
    space_ids = db.scalars(expired_spaces_query(days)).all()

    for space_id in space_ids:
        schedules_in_space = select(Schedule.id).where(Schedule.space_id == space_id)
        delete_photo_files(db, storage, DiaryPhoto.schedule_id.in_(schedules_in_space))

        # DELETE 문 하나로 지운다. 일정·멤버십과 그 아래 행은 DB의 외래키 CASCADE가 지운다.
        db.execute(delete(Space).where(Space.id == space_id))
        db.commit()

    return len(space_ids)
