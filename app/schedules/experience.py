"""일정의 시간 상태(`experience_phase`)와 기록 요약을 계산한다.

클라이언트마다 "지금 이 하루가 어느 단계인가"를 다르게 계산하지 않도록 서버가 정해서
내려준다. 웹과 앱이 같은 일정에 대해 같은 값을 받아야 화면 우선순위가 어긋나지 않는다
(docs/UX_BACKEND_HANDOFF.md 4절).

**저장하는 값이 아니다.** 날짜가 바뀌면 같은 행의 phase도 바뀌므로 조회할 때마다
계산한다. 종료 시각이 지났다는 이유만으로 `Schedule.status`를 건드리지도 않는다.
"""

from dataclasses import dataclass
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import get_settings

settings = get_settings()

# 허용값. docs/UX_BACKEND_HANDOFF.md 4절의 목록과 같아야 한다.
PHASE_UPCOMING = "upcoming"
PHASE_TODAY = "today"
PHASE_RECORD_PENDING = "record_pending"
PHASE_RECORDED = "recorded"
PHASE_CANCELED = "canceled"

# 목록 응답에 싣는 본문 미리보기 길이. 카드 한 줄에 들어갈 만큼만 자른다.
DIARY_EXCERPT_LENGTH = 80


@dataclass(frozen=True)
class DiaryContent:
    """한 일정에 달린 기록의 개수 요약.

    본문·사진·타임라인은 서로 다른 표에 흩어져 있어서, 조회할 때 한 번에 세어 이 묶음으로
    넘긴다. 화면마다 세 번씩 질의하지 않게 하기 위한 것이다.
    """

    diary_text_count: int
    photo_count: int
    timeline_count: int

    @property
    def has_any(self) -> bool:
        """셋 중 하나라도 있으면 기록이 있는 하루다.

        사진만 남긴 하루도, 한 문장만 남긴 하루도, 타임라인만 남긴 하루도 모두 기록으로
        인정한다 (docs/UX_INFORMATION_ARCHITECTURE_SPEC.md 7절).
        """
        return bool(self.diary_text_count or self.photo_count or self.timeline_count)


def _service_today() -> date:
    """서비스 기준 시간대의 오늘 날짜.

    사용자 시간대를 따로 저장하지 않고 SERVICE_TIMEZONE(기본 Asia/Seoul) 고정을 쓴다
    (2026-09-01 결정). 해외 사용자를 받게 되면 이 함수만 바꾸면 된다.
    """
    return datetime.now(ZoneInfo(settings.service_timezone)).date()


def _service_date(moment: datetime) -> date:
    """UTC 시각을 서비스 기준 날짜로 바꾼다."""
    return moment.astimezone(ZoneInfo(settings.service_timezone)).date()


def resolve_phase(
    status: str, start_at: datetime, end_at: datetime, content: DiaryContent
) -> str:
    """일정이 지금 어느 단계인지 판정한다.

    :param status: planned / completed / canceled
    :param start_at: 시작 시각 (UTC)
    :param end_at: 종료 시각 (UTC)
    :param content: 이 일정에 달린 기록 개수
    :return: PHASE_* 중 하나

    판정 순서가 곧 우선순위다.

    1. 취소된 일정은 다른 조건을 보지 않는다.
    2. 아직 시작하지 않았으면 `upcoming`.
    3. **오늘이 시작일과 종료일 사이면 `today`.** 1박 2일처럼 여러 날에 걸친 일정은
       그 기간 내내 오늘의 하루로 본다. 시작일만 보면 둘째 날에 홈에서 사라진다.
    4. 지나갔거나 완료된 뒤에는 기록이 있으면 `recorded`, 없으면 `record_pending`.

    완료 처리한 일정은 날짜가 오늘이어도 `today`가 아니다. 사용자가 "다 끝났다"고
    표시했는데 화면이 계속 진행 중으로 안내하면 안 된다.
    """
    if status == "canceled":
        return PHASE_CANCELED

    if status != "completed":
        today = _service_today()
        if _service_date(start_at) > today:
            return PHASE_UPCOMING
        if _service_date(end_at) >= today:
            return PHASE_TODAY

    return PHASE_RECORDED if content.has_any else PHASE_RECORD_PENDING


def build_excerpt(content: str | None) -> str | None:
    """본문 미리보기를 만든다. 길면 잘라내고 말줄임표를 붙인다.

    :param content: 가장 먼저 쓰인 본문. 없으면 None

    목록 응답에 본문 전체를 실으면 카드 수십 개에 안 쓰는 글이 통째로 따라온다
    (docs/UX_BACKEND_HANDOFF.md 6.1절).
    """
    if not content:
        return None

    # 줄바꿈이 그대로 오면 카드 한 줄에 넣을 때 어색하므로 공백으로 편다.
    flattened = " ".join(content.split())
    if len(flattened) <= DIARY_EXCERPT_LENGTH:
        return flattened
    return flattened[:DIARY_EXCERPT_LENGTH] + "…"
