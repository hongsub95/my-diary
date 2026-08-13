"""장소 API의 요청/응답 스키마."""

from datetime import time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# 장소 출처. 모델의 CHECK 제약(ck_places_provider)과 같은 값이어야 한다.
PROVIDER_MANUAL = "manual"
PROVIDER_KAKAO = "kakao"
PROVIDER_NAVER = "naver"
PROVIDER_GOOGLE = "google"
PROVIDERS = (PROVIDER_MANUAL, PROVIDER_KAKAO, PROVIDER_NAVER, PROVIDER_GOOGLE)

# 좌표 범위. 위도 ±90, 경도 ±180을 넘으면 지도에 찍을 수 없는 값이다.
MAX_LATITUDE = Decimal("90")
MAX_LONGITUDE = Decimal("180")


class PlaceInput(BaseModel):
    """일정에 추가할 장소의 정보.

    검색 결과를 그대로 넣을 수도 있고(provider + provider_place_id), 사용자가 직접
    입력할 수도 있다(manual). 서버는 같은 외부 장소를 두 번 저장하지 않고 재사용한다.
    """

    name: str = Field(min_length=1, max_length=200)
    address: str | None = Field(default=None, max_length=500)
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    provider: str = Field(default=PROVIDER_MANUAL, pattern=f"^({'|'.join(PROVIDERS)})$")
    provider_place_id: str | None = Field(default=None, max_length=200)

    @field_validator("name")
    @classmethod
    def validate_name_not_blank(cls, value: str) -> str:
        """공백만 입력한 이름을 거르고 앞뒤 공백을 제거한다."""
        stripped = value.strip()
        if not stripped:
            raise ValueError("장소 이름은 공백일 수 없습니다.")
        return stripped

    @field_validator("latitude")
    @classmethod
    def validate_latitude(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and abs(value) > MAX_LATITUDE:
            raise ValueError("위도는 -90에서 90 사이여야 합니다.")
        return value

    @field_validator("longitude")
    @classmethod
    def validate_longitude(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and abs(value) > MAX_LONGITUDE:
            raise ValueError("경도는 -180에서 180 사이여야 합니다.")
        return value


class SchedulePlaceCreateRequest(PlaceInput):
    """일정에 장소를 추가하는 요청.

    장소 정보(PlaceInput)에 이 일정에서만 의미 있는 값들을 더한다.
    sort_order는 받지 않는다. 항상 맨 뒤에 붙이고, 순서 조정은 reorder로만 한다.
    그래야 "추가하면서 동시에 순서를 끼워 넣는" 요청이 만들어내는 충돌이 없다.
    """

    planned_time: time | None = None
    memo: str | None = None


class SchedulePlaceUpdateRequest(BaseModel):
    """일정 속 장소의 메모·예정시각·방문여부 수정. 보낸 필드만 변경된다.

    장소 자체(이름, 좌표)는 여기서 바꾸지 않는다. 같은 Place를 다른 일정도 참조하고
    있어서, 한 일정에서 고치면 남의 기록까지 바뀐다.
    """

    planned_time: time | None = None
    memo: str | None = None
    visited: bool | None = None


class SchedulePlaceReorderRequest(BaseModel):
    """장소 순서 일괄 변경. 배열 순서가 곧 표시 순서다.

    개별 sort_order를 하나씩 보내면 중간 상태가 꼬이므로 전체를 한 번에 받는다
    (docs/API_SPEC.md 6장).
    """

    schedule_place_ids: list[int] = Field(min_length=1)


class PlaceResponse(BaseModel):
    """장소 자체의 정보. 여러 일정이 같은 장소를 공유할 수 있다."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    address: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    provider: str
    provider_place_id: str | None


class SchedulePlaceResponse(BaseModel):
    """일정에 담긴 장소 하나.

    id는 Place가 아니라 **SchedulePlace의 id**다. 수정·삭제·순서변경은 모두 이 값을
    쓴다. 같은 장소를 한 일정에 두 번 담을 수 있으므로 place.id로는 특정할 수 없다.
    """

    id: int
    place: PlaceResponse
    sort_order: int
    planned_time: time | None
    memo: str | None
    visited: bool


class SchedulePlaceListResponse(BaseModel):
    """일정의 장소 목록. sort_order 오름차순이다."""

    items: list[SchedulePlaceResponse]


class PlaceSearchResultResponse(BaseModel):
    """장소 검색 결과 하나.

    지도 공급자의 원본 응답을 그대로 전달하지 않고 이 형태로 변환한다. 공급자를
    바꿔도 클라이언트가 깨지지 않게 하기 위해서다.
    이 값을 그대로 `POST /schedules/{id}/places` 본문에 넣을 수 있다.
    """

    name: str
    address: str | None
    latitude: Decimal | None
    longitude: Decimal | None
    provider: str
    provider_place_id: str | None
    # 공급자가 주는 부가 정보. 없을 수 있으므로 화면에서 필수로 쓰지 않는다.
    category: str | None = None
    phone: str | None = None


class PlaceSearchResponse(BaseModel):
    """장소 검색 응답."""

    items: list[PlaceSearchResultResponse]
    # 어느 공급자가 답했는지. mock이면 아직 실제 지도 연동 전이라는 뜻이다.
    provider: str
