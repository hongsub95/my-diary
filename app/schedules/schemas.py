"""일정 API의 요청/응답 스키마."""

import uuid as uuid_module
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    created_by: ScheduleAuthorResponse
    # 상세 화면에 들어가기 전에 목록에서 "장소 3곳" 같은 요약을 보여주기 위한 값.
    place_count: int
    # 일기를 이미 썼는지. 목록에서 "기록 남기기" 버튼을 띄울지 판단하는 데 쓴다.
    has_diary: bool


class ScheduleListResponse(BaseModel):
    """기간별 일정 목록.

    캘린더는 기간으로 잘라 조회하므로 페이지네이션이 없다. 개수가 무한히 늘 수 있는
    전체 기록 목록을 만들 때 커서 방식을 도입한다 (docs/API_SPEC.md 5장).
    """

    items: list[ScheduleResponse]
