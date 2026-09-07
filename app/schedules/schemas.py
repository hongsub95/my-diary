"""일정 API의 요청/응답 스키마."""

import uuid as uuid_module
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.places.schemas import SchedulePlaceResponse
from app.schedules.errors import TIME_RANGE_MESSAGE

# 일정 상태. 모델의 CHECK 제약(ck_schedules_status)과 같은 값이어야 한다.
SCHEDULE_STATUS_PLANNED = "planned"
SCHEDULE_STATUS_COMPLETED = "completed"
SCHEDULE_STATUS_CANCELED = "canceled"
SCHEDULE_STATUSES = (SCHEDULE_STATUS_PLANNED, SCHEDULE_STATUS_COMPLETED, SCHEDULE_STATUS_CANCELED)


def _validate_time_range(start_at: datetime | None, end_at: datetime | None) -> None:
    """종료가 시작보다 앞서지 않는지 확인한다.

    :param start_at: 시작 시각. 수정 요청에서 안 보냈으면 None
    :param end_at: 종료 시각. 수정 요청에서 안 보냈으면 None
    :raises ValueError: 종료가 시작보다 앞설 때

    DB에도 같은 CHECK 제약이 있지만 거기까지 가면 IntegrityError(500)가 된다.
    사용자가 고칠 수 있는 입력 실수이므로 여기서 422로 돌려준다.
    """
    if start_at is not None and end_at is not None and end_at < start_at:
        raise ValueError(TIME_RANGE_MESSAGE)


class ScheduleCreateRequest(BaseModel):
    """일정 생성 요청.

    space_id는 본문이 아니라 URL 경로에서 온다. 본문에도 두면 둘이 어긋났을 때
    무엇을 따를지 애매해지고, 경로의 스페이스로 권한 검사를 이미 끝냈기 때문이다.
    """

    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_at: datetime
    end_at: datetime

    @model_validator(mode="after")
    def validate_time_range(self) -> "ScheduleCreateRequest":
        _validate_time_range(self.start_at, self.end_at)
        return self


class ScheduleUpdateRequest(BaseModel):
    """일정 수정 요청. 보낸 필드만 변경된다.

    description은 null을 보내 지울 수 있어야 하므로, "안 보냄"과 "null로 보냄"을
    구분해야 한다. `model_fields_set`으로 판단하며 서비스 계층이 이를 사용한다.
    """

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: str | None = Field(default=None, pattern=f"^({'|'.join(SCHEDULE_STATUSES)})$")

    @model_validator(mode="after")
    def validate_time_range(self) -> "ScheduleUpdateRequest":
        # 한쪽만 보낸 경우는 여기서 걸러지지 않는다. 나머지 한쪽은 DB의 기존 값과
        # 비교해야 하므로 서비스 계층에서 다시 검사한다.
        _validate_time_range(self.start_at, self.end_at)
        return self


class ScheduleAuthorResponse(BaseModel):
    """일정 작성자 표시용 최소 정보. 이메일은 담지 않는다.

    같은 스페이스 멤버라도 서로의 이메일을 알 필요는 없다. 멤버 목록 API에서만
    노출한다.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    nickname: str


class DiaryRecordSummaryResponse(BaseModel):
    """이 하루에 기록이 얼마나 남았는지 요약.

    목록에서 카드를 그리는 데 필요한 만큼만 담는다. 사진 원본이나 본문 전체는 싣지
    않는다. 기록 카드 수십 개에 안 쓰는 데이터가 통째로 따라오기 때문이다
    (docs/UX_BACKEND_HANDOFF.md 6.1절).
    """

    # 본문·사진·타임라인 중 하나라도 있는가. 기록된 하루인지 판단하는 값이다.
    has_content: bool
    # 그중 글이 있는가. 사진만 있는 하루와 구분해야 카드 문구가 달라진다.
    has_diary_text: bool
    photo_count: int
    timeline_count: int
    # 대표 사진의 썸네일 URL. 썸네일을 아직 만들지 않으므로 당분간 원본 URL이 온다.
    # 화면은 이 값을 그대로 쓰면 되고, 나중에 썸네일이 생겨도 코드를 고칠 필요가 없다.
    cover_thumbnail_url: str | None
    # 가장 먼저 쓰인 본문의 앞부분. 카드 한 줄용이며 전체는 상세에서 받는다.
    diary_excerpt: str | None


class ScheduleResponse(BaseModel):
    """일정 응답.

    space_id는 스페이스의 UUID다. 일정 자신의 id는 정수인데, 일정은 스페이스 멤버십
    없이는 접근 자체가 404라서 번호를 순서대로 찔러봐도 얻을 수 있는 정보가 없다.
    """

    id: int
    space_id: uuid_module.UUID
    space_name: str
    title: str
    description: str | None
    start_at: datetime
    end_at: datetime
    status: str
    # 실제로 완료 처리된 시각. 아직 완료하지 않았으면 null이다.
    # 기록 목록은 이 값을 기준으로 최신순 정렬한다(docs/API_SPEC.md 7장).
    completed_at: datetime | None
    created_by: ScheduleAuthorResponse
    # 상세 화면에 들어가기 전에 목록에서 "장소 3곳" 같은 요약을 보여주기 위한 값.
    place_count: int
    # 이 하루에 기록이 있는지. 본문뿐 아니라 사진·타임라인까지 합산한 값이다.
    # 사진만 남긴 하루도 기록이 있는 하루다.
    has_diary: bool
    # 지금 이 하루가 어느 단계인지. 서버가 계산해 내려주므로 웹과 앱이 같은 값을 본다.
    # upcoming / today / record_pending / recorded / canceled
    experience_phase: str
    record_summary: DiaryRecordSummaryResponse
    # 이 일정에 담긴 장소. 목록 조회에서 `include=places`를 줬을 때만 채워진다.
    #
    # null과 []를 구분한다. null은 "장소를 요청하지 않았다"이고 []는 "요청했는데
    # 장소가 없다"다. 둘을 같은 값으로 두면 홈 화면이 "장소 없는 일정"과 "아직 안
    # 받아온 일정"을 구별하지 못해, 마커가 없는 이유를 알 수 없게 된다.
    #
    # 기본 조회에서 빼두는 이유: 캘린더는 한 달치를 한 번에 받는데 일정마다 장소를
    # 붙이면 화면에 쓰지도 않을 데이터가 응답을 몇 배로 키운다. 하루 단위로 보는
    # 홈만 필요로 하므로 요청한 쪽에만 준다.
    places: list[SchedulePlaceResponse] | None = None


class ScheduleListResponse(BaseModel):
    """기간별 일정 목록.

    캘린더는 기간으로 잘라 조회하므로 페이지네이션이 없다. 개수가 무한히 늘 수 있는
    전체 기록 목록을 만들 때 커서 방식을 도입한다 (docs/API_SPEC.md 5장).
    """

    items: list[ScheduleResponse]
