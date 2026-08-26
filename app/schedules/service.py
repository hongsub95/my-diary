"""일정 비즈니스 로직.

접근 권한은 이 모듈이 판단하지 않는다. 라우터가 `MemberContext`(스페이스 멤버 확인)와
`ScheduleContext`(일정이 속한 스페이스의 멤버 확인)를 거친 뒤에 호출하므로, 여기서는
"이미 볼 수 있는 일정"이라는 전제로 규칙만 다룬다. 예외는 삭제 권한 하나뿐이다.
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import get_settings
from app.diaries.models import DiaryEntry
from app.places import service as places_service
from app.places.models import SchedulePlace
from app.places.schemas import SchedulePlaceResponse
from app.schedules.errors import (
    InvalidDateRangeError,
    InvalidTimeRangeError,
    ScheduleForbiddenError,
)
from app.schedules.schemas import (
    SCHEDULE_STATUS_COMPLETED,
    ScheduleAuthorResponse,
    ScheduleResponse,
)
from app.schedules.models import Schedule
from app.spaces.models import SPACE_ROLE_OWNER, Space, SpaceMember
from app.users.models import User

settings = get_settings()


def _service_timezone() -> ZoneInfo:
    """날짜 파라미터를 해석할 기준 시간대.

    get_settings()가 캐시되므로 매번 ZoneInfo를 만드는 비용은 무시할 수 있다.
    """
    return ZoneInfo(settings.service_timezone)


def resolve_date_range(from_date: date | None, to_date: date | None) -> tuple[datetime, datetime]:
    """`YYYY-MM-DD` 조회 파라미터를 UTC 시각 범위로 바꾼다.

    :param from_date: 조회 시작일. None이면 이번 달 1일
    :param to_date: 조회 종료일(그날 포함). None이면 from_date가 속한 달의 말일
    :raises InvalidDateRangeError: from이 to보다 뒤일 때
    :return: (범위 시작, 범위 끝) — 끝은 **미포함**인 UTC 시각

    날짜를 서비스 기준 시간대(기본 Asia/Seoul)의 하루로 해석한다. UTC로 해석하면
    한국 시간 오전 0~9시 약속이 달 경계에서 목록에 안 잡힌다. 예를 들어 8월 1일
    오전 6시(KST) 약속은 UTC로 7월 31일 21시라, `from=2026-08-01`을 UTC로 읽으면
    8월 목록에서 사라진다.

    끝을 '말일 23:59:59'가 아니라 '다음 날 0시 미만'으로 잡는 이유: 초 단위로 자르면
    23:59:59.5 같은 값이 조용히 빠진다.
    """
    tz = _service_timezone()

    if from_date is None:
        from_date = datetime.now(tz).date().replace(day=1)
    if to_date is None:
        to_date = _last_day_of_month(from_date)

    if from_date > to_date:
        raise InvalidDateRangeError()

    range_start = datetime.combine(from_date, time.min, tzinfo=tz)
    # to_date 그날까지 포함해야 하므로 하루를 더해 그 시작 직전까지로 잡는다.
    range_end = datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=tz)

    return range_start.astimezone(timezone.utc), range_end.astimezone(timezone.utc)


def _last_day_of_month(day: date) -> date:
    """주어진 날짜가 속한 달의 말일."""
    # 다음 달 1일에서 하루를 빼면 말일이다. 달마다 다른 일수와 윤년을 직접 다루지 않아도 된다.
    first_of_next_month = (day.replace(day=1) + timedelta(days=32)).replace(day=1)
    return first_of_next_month - timedelta(days=1)


def _place_count_column():
    """일정별 장소 개수를 세는 상관 서브쿼리.

    목록을 만들 때 일정마다 따로 세면 N+1 질의가 된다. 한 번의 질의로 끝내기 위해
    select 절에 서브쿼리로 넣는다.
    """
    return (
        select(func.count(SchedulePlace.id))
        .where(SchedulePlace.schedule_id == Schedule.id)
        .correlate(Schedule)
        .scalar_subquery()
    )


def _has_diary_column():
    """일기가 있는지 여부. 개수는 필요 없으므로 EXISTS로 처리한다."""
    return exists().where(DiaryEntry.schedule_id == Schedule.id).correlate(Schedule)


def to_response(
    schedule: Schedule,
    place_count: int,
    has_diary: bool,
    places: list[SchedulePlaceResponse] | None = None,
) -> ScheduleResponse:
    """Schedule 모델을 API 응답 형태로 바꾼다.

    :param schedule: space와 created_by_user가 이미 로드된 일정
    :param place_count: 이 일정에 담긴 장소 수
    :param has_diary: 이 일정에 일기가 있는지
    :param places: 장소 목록. None이면 응답에서도 null이 되어 "요청하지 않았다"는
        뜻이 된다. 빈 리스트는 "요청했는데 장소가 없다"로 다르게 읽힌다.
    """
    return ScheduleResponse(
        id=schedule.id,
        space_id=schedule.space.uuid,
        space_name=schedule.space.name,
        title=schedule.title,
        description=schedule.description,
        start_at=schedule.start_at,
        end_at=schedule.end_at,
        status=schedule.status,
        created_by=ScheduleAuthorResponse.model_validate(schedule.created_by_user),
        place_count=place_count,
        has_diary=has_diary,
        places=places,
    )


def list_schedules(
    db: Session,
    space: Space,
    from_date: date | None,
    to_date: date | None,
    status: str | None,
    include_places: bool = False,
) -> list[ScheduleResponse]:
    """스페이스의 기간별 일정 목록을 start_at 오름차순으로 돌려준다.

    :param db: DB 세션
    :param space: 조회 대상 스페이스 (권한 검사는 라우터에서 끝남)
    :param from_date: 조회 시작일. None이면 이번 달 1일
    :param to_date: 조회 종료일. None이면 from_date가 속한 달의 말일
    :param status: planned/completed/canceled 중 하나. None이면 전체
    :param include_places: True면 각 일정에 장소 목록을 함께 담는다. 홈 화면처럼
        하루의 장소와 방문 순서를 지도에 찍어야 하는 화면이 쓴다. False면 응답의
        places가 null이 되고 질의도 나가지 않는다.
    :raises InvalidDateRangeError: from이 to보다 뒤일 때
    """
    range_start, range_end = resolve_date_range(from_date, to_date)

    # 기간에 '겹치는' 일정을 모두 가져온다. start_at만 범위에 넣으면, 7월 30일에
    # 시작해 8월 2일에 끝나는 여행이 8월 캘린더에서 통째로 사라진다.
    #
    # 끝나는 순간이 범위 시작과 정확히 같은 일정(7월 31일 23시~24시 KST)은 제외한다.
    # 8월에 머문 시간이 0이라 8월 달력에 띄우면 어색하다. 다만 start_at == end_at인
    # 순간 일정은 그 논리로 지우면 안 되므로, 시작이 범위 안이면 살린다.
    conditions = [
        Schedule.space_id == space.id,
        Schedule.start_at < range_end,
        or_(Schedule.end_at > range_start, Schedule.start_at >= range_start),
    ]
    if status is not None:
        conditions.append(Schedule.status == status)

    # space와 작성자를 함께 읽어 응답을 만들 때 추가 질의가 나가지 않게 한다.
    options = [joinedload(Schedule.space), joinedload(Schedule.created_by_user)]
    if include_places:
        # 장소는 일정당 여러 건이라 joinedload로 붙이면 일정 행이 장소 수만큼 복제된다.
        # selectinload는 일정을 먼저 읽고 장소를 IN 한 번으로 가져오므로, 일정이 몇
        # 개든 질의는 두 번으로 끝난다.
        options.append(selectinload(Schedule.places).joinedload(SchedulePlace.place))

    rows = db.execute(
        select(Schedule, _place_count_column(), _has_diary_column())
        .options(*options)
        .where(*conditions)
        .order_by(Schedule.start_at, Schedule.id)
    ).all()

    # 같은 start_at이 여럿일 때 순서가 뒤집히지 않도록 id를 2차 정렬 기준으로 뒀다.
    return [
        to_response(
            schedule,
            place_count,
            has_diary,
            _places_response(schedule) if include_places else None,
        )
        for schedule, place_count, has_diary in rows
    ]


def _places_response(schedule: Schedule) -> list[SchedulePlaceResponse]:
    """이미 로드된 장소를 방문 순서대로 응답 형태로 바꾼다.

    :param schedule: places와 각 장소의 place가 로드된 일정

    정렬 기준을 GET /schedules/{id}/places와 똑같이 (sort_order, id)로 맞춘다.
    관계 정의는 sort_order까지만 정렬하므로, 같은 순서 값이 겹치면 두 API가 서로
    다른 차례로 장소를 보여줄 수 있다. 화면에는 순서가 숫자로 찍히기 때문에 이런
    불일치는 사용자 눈에 바로 띈다.
    """
    ordered = sorted(schedule.places, key=lambda item: (item.sort_order, item.id))
    return [places_service.to_response(item) for item in ordered]


def load_response(db: Session, schedule: Schedule) -> ScheduleResponse:
    """일정 하나의 응답을 만든다. 장소 수와 일기 유무를 한 번의 질의로 가져온다."""
    place_count, has_diary = db.execute(
        select(_place_count_column(), _has_diary_column()).where(Schedule.id == schedule.id)
    ).one()
    return to_response(schedule, place_count, has_diary)


def create_schedule(
    db: Session,
    space: Space,
    user: User,
    title: str,
    description: str | None,
    start_at: datetime,
    end_at: datetime,
) -> Schedule:
    """새 일정을 만든다.

    :param space: 일정이 속할 스페이스
    :param user: 작성자. 표시용이며 접근 제어에는 쓰지 않는다
    :return: 생성된 Schedule
    """
    schedule = Schedule(
        space_id=space.id,
        created_by=user.id,
        title=title,
        description=description,
        start_at=start_at,
        end_at=end_at,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


def update_schedule(db: Session, schedule: Schedule, changes: dict) -> Schedule:
    """일정을 부분 수정한다.

    :param changes: 실제로 요청 본문에 담겨 온 필드만 들어 있는 dict.
        "안 보냄"과 "null로 보냄"을 구분해야 description을 지울 수 있다.
    :raises InvalidTimeRangeError: 수정 결과 종료 시각이 시작 시각보다 앞서게 될 때
    """
    # 한쪽만 바꾸는 경우가 있으므로 기존 값과 합쳐서 최종 상태로 검사한다.
    # 예: end_at만 앞으로 당겨 기존 start_at보다 빨라지는 경우. 보낸 필드만 봐서는
    # 이 조합을 잡을 수 없어 DB CHECK 위반(500)까지 간다.
    new_start = changes.get("start_at", schedule.start_at)
    new_end = changes.get("end_at", schedule.end_at)
    if new_end < new_start:
        raise InvalidTimeRangeError()

    for field, value in changes.items():
        setattr(schedule, field, value)

    db.commit()
    db.refresh(schedule)
    return schedule


def complete_schedule(db: Session, schedule: Schedule) -> Schedule:
    """일정을 완료 상태로 바꾼다. 이미 완료여도 오류로 보지 않는다.

    같은 요청을 두 번 보내도 결과가 같아야 한다. 네트워크가 끊겨 재시도했을 때
    409를 받으면 클라이언트가 처리하기 번거롭기 때문이다.
    """
    schedule.status = SCHEDULE_STATUS_COMPLETED
    db.commit()
    db.refresh(schedule)
    return schedule


def ensure_can_delete(db: Session, schedule: Schedule, membership: SpaceMember, user: User) -> None:
    """일정을 지울 권한이 있는지 확인한다.

    :param membership: 요청자의 이 스페이스 멤버십 (활성임이 보장됨)
    :param user: 요청자
    :raises ScheduleForbiddenError: 남이 만든 일정을 일반 멤버가 지우려 할 때

    스페이스 owner는 모든 일정을, 일반 멤버는 본인이 만든 일정만 지울 수 있다
    (docs/API_SPEC.md 4.6절). 개인 스페이스는 본인이 owner라 항상 통과한다.
    """
    if membership.role == SPACE_ROLE_OWNER:
        return
    if schedule.created_by == user.id:
        return
    raise ScheduleForbiddenError("다른 사람이 만든 일정은 삭제할 수 없습니다.")


def delete_schedule(db: Session, schedule: Schedule) -> None:
    """일정을 삭제한다.

    장소·일기·사진·공유링크는 외래키가 CASCADE라 함께 사라진다. 보관(소프트 삭제)이
    아니라 실제 삭제인 이유: 스페이스와 달리 일정은 잘못 만든 것을 지우는 일이 흔하고,
    목록에 남으면 캘린더가 지저분해진다.
    """
    db.delete(schedule)
    db.commit()
