"""코스 추천 API의 요청/응답 스키마."""

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# service.py가 이 모듈을 불러오므로, 정책값은 service가 아니라 여기서 정의해 순환을 피한다.
RADIUS_OPTIONS_M = (500, 1000, 2000, 5000)
MAX_ITEM_COUNT = 6
PARTY_SIZES = (
    ("1", "1명"),
    ("2", "2명"),
    ("3-4", "3~4명"),
    ("5+", "5명 이상"),
)
PARTY_SIZE_CODES = {code for code, _ in PARTY_SIZES}


class ChoiceOption(BaseModel):
    """코드와 화면 이름의 짝. 화면은 code를 보내고 label을 보여준다."""

    code: str
    label: str


class CategoryOption(ChoiceOption):
    """대분류 하나와 그에 딸린 소분류.

    소분류를 대분류 안에 넣어 내려준다. 화면이 대분류를 바꾸면 그 안의 목록으로만
    소분류를 다시 그리면 되고, 다른 대분류의 소분류를 고를 길이 처음부터 없다.
    """

    subcategories: list[ChoiceOption]


class RecommendationOptionsResponse(BaseModel):
    """추천 폼을 그리는 데 필요한 선택지.

    화면이 목록을 따로 들고 있지 않게 서버가 내려준다(API_SPEC 추천 폼 옵션). 카테고리를
    고치거나 반경 선택지를 바꿀 때 웹·앱을 다시 배포하지 않아도 된다.
    """

    categories: list[CategoryOption]
    # 기준 장소에서 찾을 반경(m). 직선거리다.
    radius_options_m: list[int]
    default_radius_m: int
    # 인원 구간. 결과를 바꾸지 않고 "수용 인원 확인 필요" 경고에만 쓴다.
    party_sizes: list[ChoiceOption]
    default_item_count: int
    max_item_count: int
    # 거리 계산 근거. 경로 API가 열리면 값이 늘어난다.
    basis: Literal["straight_line"]


# ── 코스 추천 미리보기 ─────────────────────────────────


class AnchorInput(BaseModel):
    """기준 장소. 하루에 이미 담아 둔 장소 하나를 중심으로 주변을 찾는다.

    position이 after면 기준 장소 다음에 갈 곳들을, before면 기준 장소 전에 들를 곳들을
    추천한다. 예약해 둔 저녁 식당을 기준으로 "그 전에 갈 카페"를 찾는 식이다.
    """

    schedule_place_id: int
    position: Literal["before", "after"] = "after"


class CourseItemInput(BaseModel):
    """코스 항목 하나. 화면에서 "코스 추가"로 쌓는 칸이다."""

    category: str = Field(min_length=1, max_length=40)
    subcategory: str = Field(default="any", min_length=1, max_length=40)


class CoursePreviewRequest(BaseModel):
    """코스 추천 미리보기 요청.

    기준 장소와 지역 중 하나는 있어야 한다. 둘 다 오면 기준 장소를 쓴다 — 지역보다
    구체적이고, 사용자가 이미 가기로 한 곳이기 때문이다.
    """

    anchor: AnchorInput | None = None
    area_query: str | None = Field(default=None, max_length=100)
    radius_m: int
    party_size: str = "2"
    items: list[CourseItemInput] = Field(min_length=1, max_length=MAX_ITEM_COUNT)

    @field_validator("area_query")
    @classmethod
    def normalize_area(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @field_validator("radius_m")
    @classmethod
    def validate_radius(cls, value: int) -> int:
        """폼이 내려준 선택지만 받는다. 아무 값이나 받으면 카카오 쿼터를 예측할 수 없다."""
        if value not in RADIUS_OPTIONS_M:
            raise ValueError(f"반경은 {', '.join(map(str, RADIUS_OPTIONS_M))} 중 하나여야 합니다.")
        return value

    @field_validator("party_size")
    @classmethod
    def validate_party_size(cls, value: str) -> str:
        if value not in PARTY_SIZE_CODES:
            raise ValueError("인원 구간이 올바르지 않습니다.")
        return value

    @model_validator(mode="after")
    def require_anchor_or_area(self) -> "CoursePreviewRequest":
        if self.anchor is None and self.area_query is None:
            raise ValueError("기준 장소나 지역 중 하나는 정해야 합니다.")
        return self


class CourseCenter(BaseModel):
    """주변을 찾은 중심. 화면이 지도를 여기에 맞추고 "○○ 주변"이라고 적는다."""

    label: str
    latitude: Decimal
    longitude: Decimal


class CoursePlace(BaseModel):
    """코스 안의 장소 하나.

    추천 장소는 이 값의 name·address·latitude·longitude·provider·provider_place_id를
    그대로 `POST /schedules/{id}/places`에 넣을 수 있다. 장소 검색 결과와 같은 규칙이다.
    """

    kind: Literal["anchor", "recommended"]
    # 기준 장소일 때만 있다. 이미 하루에 담긴 장소의 id다.
    schedule_place_id: int | None = None
    # 추천 장소일 때만 있다. 몇 번째 코스 항목을 채운 장소인지.
    item_index: int | None = None
    category: str | None = None
    subcategory: str | None = None
    name: str
    address: str | None
    latitude: Decimal
    longitude: Decimal
    provider: str
    provider_place_id: str | None
    phone: str | None = None
    # 사용자에게 보일 추천 이유. 자유 생성문이 아니라 정해진 틀로 만든다(기획서 7.4절).
    reason: str | None = None
    reason_codes: list[str] = []
    warnings: list[str] = []


class CourseLeg(BaseModel):
    """코스 안 두 장소 사이. 직선거리다."""

    from_index: int
    to_index: int
    distance_m: int


class CourseCandidate(BaseModel):
    """제안하는 코스 하나. rank 1이 가장 짧다."""

    rank: int
    total_distance_m: int
    places: list[CoursePlace]
    legs: list[CourseLeg]


class RelaxationSuggestion(BaseModel):
    """후보가 없을 때 조건을 어떻게 풀면 되는지(기획서 13절).

    - WIDEN_RADIUS: radius_m으로 넓혀 보라
    - USE_ANY_SUBCATEGORY: item_index 항목의 소분류를 "상관없음"으로 바꿔 보라
    """

    code: Literal["WIDEN_RADIUS", "USE_ANY_SUBCATEGORY"]
    item_index: int | None = None
    radius_m: int | None = None


class CoursePreviewResponse(BaseModel):
    """코스 추천 미리보기 결과. **일정은 바뀌지 않는다.**"""

    center: CourseCenter
    candidates: list[CourseCandidate]
    # 후보가 하나도 없던 항목. 하나라도 있으면 코스를 만들 수 없어 candidates가 빈다.
    empty_item_indexes: list[int]
    relaxation_suggestions: list[RelaxationSuggestion]
    basis: Literal["straight_line"]
