"""일기 비즈니스 로직.

접근 권한은 이 모듈이 판단하지 않는다. 라우터가 `ScheduleMemberContext`로 "그 일정을
볼 수 있는가"를 이미 확인한 뒤에 호출한다. 여기서는 일정 안에서의 규칙만 다룬다.

남의 본문을 지목할 수 있는 함수를 두지 않았다. 모든 함수가 (일정, 사용자) 짝으로
행을 찾으므로, 실수로 남의 글을 고치거나 지우는 경로 자체가 만들어지지 않는다.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.diaries.errors import DiaryEntryNotFoundError
from app.diaries.models import DiaryEntry
from app.schedules.models import Schedule
from app.users.models import User


def get_my_entry(db: Session, schedule: Schedule, user: User) -> DiaryEntry:
    """내가 이 일정에 쓴 본문을 가져온다.

    :param schedule: 접근 권한 확인이 끝난 일정
    :param user: 요청자
    :raises DiaryEntryNotFoundError: 아직 쓰지 않았을 때 (404)
    """
    entry = _find_my_entry(db, schedule, user)
    if entry is None:
        raise DiaryEntryNotFoundError()
    return entry


def _find_my_entry(db: Session, schedule: Schedule, user: User) -> DiaryEntry | None:
    """내 본문을 찾는다. 없으면 None. 작성자 정보까지 함께 읽는다."""
    return db.scalar(
        select(DiaryEntry)
        .options(joinedload(DiaryEntry.author))
        .where(DiaryEntry.schedule_id == schedule.id, DiaryEntry.author_id == user.id)
    )


def list_entries(db: Session, schedule: Schedule) -> list[DiaryEntry]:
    """이 일정에 달린 작성자별 본문을 먼저 쓴 순서로 돌려준다.

    작성 순서로 두는 이유: 같이 보낸 하루의 기록이라 누가 먼저 남겼는지가 자연스러운
    흐름이고, 요청자를 맨 위로 올리면 두 사람이 같은 화면을 봐도 순서가 달라진다.
    """
    return list(
        db.scalars(
            select(DiaryEntry)
            .options(joinedload(DiaryEntry.author))
            .where(DiaryEntry.schedule_id == schedule.id)
            # created_at이 같은 순간이면(동시 저장) id로 안정적으로 정렬한다.
            .order_by(DiaryEntry.created_at, DiaryEntry.id)
        ).all()
    )


def upsert_my_entry(
    db: Session, schedule: Schedule, user: User, content: str, mood: str | None
) -> tuple[DiaryEntry, bool]:
    """내 본문을 쓰거나 고친다.

    :return: (본문, 새로 만들었는지) — 라우터가 201과 200을 구분하는 데 쓴다

    작성자당 본문은 하나이므로 (schedule_id, author_id)로 찾아 있으면 갈아끼운다.
    DB에도 같은 UNIQUE 제약이 있어, 두 요청이 동시에 들어와 둘 다 "없음"으로 판단해도
    한쪽은 무결성 오류로 막힌다.
    """
    entry = _find_my_entry(db, schedule, user)
    created = entry is None

    if entry is None:
        entry = DiaryEntry(schedule_id=schedule.id, author_id=user.id, content=content, mood=mood)
        db.add(entry)
    else:
        entry.content = content
        entry.mood = mood

    db.commit()
    db.refresh(entry)
    return entry, created


def delete_my_entry(db: Session, schedule: Schedule, user: User) -> None:
    """내 본문을 지운다.

    :raises DiaryEntryNotFoundError: 쓴 적이 없을 때

    사진과 타임라인은 함께 지우지 않는다. 하루의 사진·동선은 공용이라 한 사람이 자기
    글을 지웠다고 사라지면 안 된다 (docs/API_SPEC.md 7장).
    """
    entry = get_my_entry(db, schedule, user)
    db.delete(entry)
    db.commit()
