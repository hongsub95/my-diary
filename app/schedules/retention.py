"""보관 기간이 지난 지운 일정 파기.

일정을 지우면 바로 없애지 않고 `use=0`·`deleted_at`만 표시한다(소프트 삭제). 앱에는
되돌리기 기능이 없으므로 이 보관은 "혹시 모를 상황"에 운영자가 복구할 여지를 두는 것일
뿐이다. 보관 기간이 지나면 남겨둘 이유가 없어 **행까지 실제로 지운다**(2026-10-19 결정).

**계정과 다르게 행을 지워도 되는 이유.** 탈퇴 계정은 nl_users.id 외래키가 전부
CASCADE라 행을 지우면 남의 기록까지 사라져서 개인정보만 덮어쓴다(app/users/retention.py).
일정은 다르다. 일정에 딸린 장소·일기·사진·타임라인은 **그 일정의 것**이고, 사용자가
이미 일정을 지우면서 함께 지워진다는 안내를 보고 동의했다. 그래서 일정 행을 지우면 DB가
외래키 CASCADE로 딸린 행을 함께 지우는 것이 의도한 결과다.

**사진 파일은 DB 밖에 있어 CASCADE로 지워지지 않는다.** 행을 지우기 전에 저장소에서
원본과 썸네일을 직접 지운다. 순서는 사진 한 장을 지울 때(photo_service.delete_photo)와
반대로 **파일 먼저, 행 나중**이다.

- 행을 먼저 지우고 파일 삭제가 실패하면 파일 키를 가진 행이 없어져 다시 시도할 수 없다.
  파일이 영원히 남아 보관 기간을 지키지 못한다.
- 파일을 먼저 지우면 실패해도 행이 남아 다음 실행에서 다시 시도된다. 이 일정은 이미
  `use=0`이라 어떤 화면에도 나오지 않으므로 "행은 있는데 사진이 깨지는" 모습이 사용자에게
  보이지 않는다. 저장소의 delete는 이미 없는 파일에 조용히 넘어가므로 다시 돌려도 안전하다.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.storage import FileStorage, get_storage
from app.diaries.models import DiaryPhoto
from app.schedules.models import SCHEDULE_NOT_IN_USE, Schedule

# 지운 일정의 보관 기간. 탈퇴 계정과 같은 90일이다.
DELETED_SCHEDULE_RETENTION_DAYS = 90


def expired_schedules_query(days: int = DELETED_SCHEDULE_RETENTION_DAYS):
    """파기 대상 일정 id를 고르는 조건.

    :param days: 보관 기간
    :return: Schedule.id를 고르는 select 문

    실제 파기와 미리보기(scripts/purge_expired_data.py --dry-run)가 이 하나를 함께 쓴다.
    조건을 양쪽에 따로 적으면 한쪽만 고쳐져 미리보기가 실제와 다른 수를 알려준다.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return select(Schedule.id).where(
        # 사용 중인 일정은 아무리 오래돼도 건드리지 않는다. deleted_at만 보지 않고 use도
        # 함께 거는 이유: 두 값이 어긋난 행이 생겨도 살아 있는 일정을 지우는 일은 없게 한다.
        Schedule.use == SCHEDULE_NOT_IN_USE,
        Schedule.deleted_at.is_not(None),
        Schedule.deleted_at < cutoff,
    )


def purge_expired_schedules(
    db: Session,
    days: int = DELETED_SCHEDULE_RETENTION_DAYS,
    storage: FileStorage | None = None,
) -> int:
    """보관 기간이 지난 지운 일정을 사진 파일과 함께 파기한다.

    :param days: 보관 기간
    :param storage: 사진 저장소. 생략하면 설정의 저장소(로컬/S3)를 쓴다
    :return: 파기한 일정 수

    일정 하나씩 "파일 삭제 → 행 삭제 → 커밋"을 끝내고 다음으로 넘어간다. 중간에 저장소
    오류가 나면 거기서 멈추고 예외를 올린다. 이미 끝낸 일정은 커밋돼 있고, 못 끝낸 일정은
    행이 남아 다음 실행에서 다시 잡힌다. **여러 번 돌려도 안전하다.**
    """
    storage = storage or get_storage()
    schedule_ids = db.scalars(expired_schedules_query(days)).all()

    for schedule_id in schedule_ids:
        photos = db.execute(
            select(DiaryPhoto.storage_key, DiaryPhoto.thumbnail_key).where(DiaryPhoto.schedule_id == schedule_id)
        ).all()
        for storage_key, thumbnail_key in photos:
            storage.delete(storage_key)
            # 썸네일은 생성 전이거나 실패했으면 없다.
            if thumbnail_key:
                storage.delete(thumbnail_key)

        # ORM으로 객체를 불러 지우지 않고 DELETE 문 하나로 지운다. 딸린 장소·일기·사진·
        # 타임라인 행은 DB의 외래키 CASCADE가 지우므로 하나씩 불러올 필요가 없다.
        db.execute(delete(Schedule).where(Schedule.id == schedule_id))
        db.commit()

    return len(schedule_ids)
