"""기록 탭 목록 로직.

완료했거나 지나간 하루를 최신순으로 훑는 화면(`기록` 탭)이 쓴다. 일정 목록과 달리
기간으로 자르지 않고 계속 아래로 내려가므로 **커서 페이지네이션**을 쓴다
(docs/API_SPEC.md 5장, docs/UX_BACKEND_HANDOFF.md 6.3절).

오프셋(`page=2`)을 쓰지 않는 이유: 사용자가 목록을 보는 중에 새 기록이 생기면 오프셋이
한 칸씩 밀려 같은 항목을 두 번 보거나 하나를 건너뛴다. 커서는 "마지막으로 본 지점"을
가리키므로 그 사이 무엇이 추가돼도 이어보기가 어긋나지 않는다.
"""

import base64
import binascii
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select, tuple_
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.diaries.errors import InvalidDiaryCursorError
from app.diaries.models import DiaryEntry
from app.schedules.models import Schedule
from app.schedules.service import _SUMMARY_COLUMNS, _place_count_column
from app.spaces.models import Space

settings = get_settings()

# 한 번에 돌려주는 기본·최대 개수. 화면이 무한 스크롤로 이어 받는다.
DEFAULT_LIMIT = 20
MAX_LIMIT = 50

# 커서 문자열을 만들 때 시각과 id를 잇는 구분자.
_CURSOR_SEPARATOR = "|"


@dataclass(frozen=True)
class DiaryFeedPage:
    """한 페이지 분량의 기록과 다음 커서."""

    rows: list
    next_cursor: str | None


def _service_timezone() -> ZoneInfo:
    return ZoneInfo(settings.service_timezone)


def sort_at_column():
    """기록을 늘어놓는 기준 시각.

    완료 처리한 시각을 우선 쓰고, 없으면 종료 시각으로 대신한다. 지난 일정을 뒤늦게
    완료하면 그 하루가 목록 맨 위로 와야 하는데, end_at만 쓰면 아래에 묻힌다.
    completed_at만 쓰면 완료를 누르지 않은 지난 일정이 목록에서 사라진다.
    """
    return func.coalesce(Schedule.completed_at, Schedule.end_at)


def _has_content_condition():
    """본문·사진·타임라인 중 하나라도 있는가.

    세 표를 각각 EXISTS로 확인한다. 개수는 필요 없고 "있는지"만 보면 되므로, 첫 행을
    찾는 순간 멈추는 EXISTS가 COUNT보다 싸다.
    """
    from app.diaries.models import DiaryPhoto, DiaryTimelineItem

    return or_(
        select(DiaryEntry.id).where(DiaryEntry.schedule_id == Schedule.id).exists(),
        select(DiaryPhoto.id).where(DiaryPhoto.schedule_id == Schedule.id).exists(),
        select(DiaryTimelineItem.id)
        .where(DiaryTimelineItem.schedule_id == Schedule.id)
        .exists(),
    )


def _past_or_completed_condition() -> tuple:
    """기록 탭에 오를 수 있는 하루인가.

    아직 오지 않았거나 오늘 진행 중인 일정은 기록이 아니라 계획이라 제외한다. 취소한
    일정도 홈과 기록에서 빼기로 되어 있다(docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 7절).

    "지났다"의 기준은 서비스 시간대의 오늘 0시다. experience_phase의 today 판정과 같은
    기준이어야 목록과 카드 상태가 어긋나지 않는다.
    """
    tz = _service_timezone()
    today_start = datetime.combine(datetime.now(tz).date(), time.min, tzinfo=tz)
    return (
        Schedule.status != "canceled",
        or_(Schedule.status == "completed", Schedule.end_at < today_start.astimezone(timezone.utc)),
    )


def _month_range(year: int, month: int) -> tuple[datetime, datetime]:
    """해당 연월의 시작과 끝(다음 달 1일)을 UTC로 돌려준다.

    한국 시간 기준 한 달로 해석한다. UTC로 자르면 한국 시간 새벽 일정이 달 경계에서
    빠진다. 일정 목록의 from/to와 같은 규칙이다(docs/API_SPEC.md 5.1절).
    """
    tz = _service_timezone()
    start = datetime.combine(date(year, month, 1), time.min, tzinfo=tz)
    # 다음 달 1일. 12월이면 해가 넘어간다.
    next_month = date(year + (month == 12), 1 if month == 12 else month + 1, 1)
    end = datetime.combine(next_month, time.min, tzinfo=tz)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def encode_cursor(sort_at: datetime, schedule_id: int) -> str:
    """다음 페이지 시작점을 문자열로 만든다.

    내용을 base64로 감싸는 이유: 클라이언트가 값을 해석해 직접 만들어 보내기 시작하면
    정렬 기준을 바꿀 때 그쪽이 함께 깨진다. 커서는 서버가 준 값을 그대로 돌려주는
    불투명한 토큰으로 다룬다.
    """
    raw = f"{sort_at.isoformat()}{_CURSOR_SEPARATOR}{schedule_id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, int]:
    """커서를 (기준 시각, 일정 id)로 되돌린다.

    :raises InvalidDiaryCursorError: 우리가 만든 커서가 아닐 때
    """
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        sort_text, id_text = raw.split(_CURSOR_SEPARATOR)
        return datetime.fromisoformat(sort_text), int(id_text)
    except (ValueError, binascii.Error, UnicodeDecodeError) as error:
        raise InvalidDiaryCursorError() from error


def list_space_diaries(
    db: Session,
    space: Space,
    cursor: str | None = None,
    limit: int = DEFAULT_LIMIT,
    year: int | None = None,
    month: int | None = None,
    include_pending: bool = False,
) -> DiaryFeedPage:
    """스페이스의 기록을 최신순으로 한 페이지 돌려준다.

    :param cursor: 이전 응답의 next_cursor. 없으면 처음부터
    :param limit: 최대 개수. MAX_LIMIT을 넘으면 잘라낸다
    :param year: 연도 필터. month와 함께 준다
    :param month: 월 필터
    :param include_pending: True면 아직 기록이 없는 지난 하루도 포함한다
    :raises InvalidDiaryCursorError: 커서 형식이 잘못됐을 때

    기본은 기록이 있는 하루만 담는다. 기록 대기는 목록 상단의 별도 영역에서 따로
    보여주기로 되어 있어(docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 3.6절) 섞지 않는다.
    """
    limit = max(1, min(limit, MAX_LIMIT))
    sort_at = sort_at_column()

    conditions = [Schedule.space_id == space.id, *_past_or_completed_condition()]
    if not include_pending:
        conditions.append(_has_content_condition())
    if year is not None and month is not None:
        start, end = _month_range(year, month)
        conditions.extend([sort_at >= start, sort_at < end])
    if cursor is not None:
        cursor_at, cursor_id = decode_cursor(cursor)
        # (시각, id) 쌍을 통째로 비교한다. 시각만 비교하면 같은 시각에 끝난 하루가
        # 여럿일 때 경계에서 빠지거나 겹친다.
        conditions.append(tuple_(sort_at, Schedule.id) < tuple_(cursor_at, cursor_id))

    # 한 개 더 읽어본다. 그게 있으면 다음 페이지가 있다는 뜻이고, 없으면 여기서 끝이다.
    # 카드에 필요한 장소 수와 기록 요약을 함께 읽는다. 일정 목록과 같은 서브쿼리를
    # 재사용해야 두 화면의 대표 사진과 발췌가 어긋나지 않는다.
    rows = db.execute(
        select(Schedule, sort_at.label("sort_at"), _place_count_column(), *_SUMMARY_COLUMNS)
        .options(joinedload(Schedule.space), joinedload(Schedule.created_by_user))
        .where(*conditions)
        # id까지 정렬 기준에 넣어야 같은 시각의 항목 순서가 매번 같다. 순서가 흔들리면
        # 커서로 이어 받을 때 항목이 중복되거나 빠진다.
        .order_by(sort_at.desc(), Schedule.id.desc())
        .limit(limit + 1)
    ).all()

    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = encode_cursor(page[-1][1], page[-1][0].id) if has_more and page else None

    return DiaryFeedPage(rows=page, next_cursor=next_cursor)


def load_authors(db: Session, schedule_ids: list[int]) -> dict[int, list]:
    """일정별로 본문을 쓴 사람들을 모아 온다.

    :return: {일정 id: [User, ...]} — 먼저 쓴 순서

    한 건씩 조회하면 페이지 크기만큼 질의가 늘어나므로 IN 하나로 받아 나눈다.
    """
    if not schedule_ids:
        return {}

    entries = db.scalars(
        select(DiaryEntry)
        .options(joinedload(DiaryEntry.author))
        .where(DiaryEntry.schedule_id.in_(schedule_ids))
        .order_by(DiaryEntry.created_at, DiaryEntry.id)
    ).all()

    grouped: dict[int, list] = {}
    for entry in entries:
        grouped.setdefault(entry.schedule_id, []).append(entry.author)
    return grouped
