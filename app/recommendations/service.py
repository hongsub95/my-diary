"""코스 추천의 정책값과 폼 옵션.

추천 Phase 1은 **직선거리 기준**이다. 실제 이동시간을 주는 카카오모빌리티 길찾기는 제휴
계약이 있어야 열려서, 기획서의 "10분 이내" 같은 이동시간 구간 대신 거리 반경을 받는다.
기획서도 직선거리를 최종 이동시간처럼 보여주지 말라고 정해 두었다
(docs/COURSE_RECOMMENDATION_SPEC.md 6.2절).

같은 이유로 예산·분위기·공간·이동수단은 받지 않는다. 카카오가 그 정보를 주지 않아서,
폼에 두면 골라도 결과가 바뀌지 않는 칸이 된다(2026-10-02 결정).
"""

from app.recommendations.categories import CATEGORIES
from app.recommendations.schemas import (
    CategoryOption,
    ChoiceOption,
    RecommendationOptionsResponse,
)

# 기준 장소에서 찾을 반경(m). 도보는 1km 안쪽, 차는 5km까지가 체감에 맞는다.
RADIUS_OPTIONS_M = (500, 1000, 2000, 5000)
DEFAULT_RADIUS_M = 1000

# 인원 구간(기획서 4.1절). 카카오가 단체 수용 정보를 주지 않아 결과를 거르지는 못한다.
PARTY_SIZES = (
    ("1", "1명"),
    ("2", "2명"),
    ("3-4", "3~4명"),
    ("5+", "5명 이상"),
)

# 코스 항목 수(기획서 4.2절). 기본 3개, 최대 6개.
DEFAULT_ITEM_COUNT = 3
MAX_ITEM_COUNT = 6


def build_options() -> RecommendationOptionsResponse:
    """추천 폼의 선택지를 만든다. 사용자와 무관하게 늘 같다."""
    return RecommendationOptionsResponse(
        categories=[
            CategoryOption(
                code=category.code,
                label=category.label,
                subcategories=[
                    ChoiceOption(code=sub.code, label=sub.label)
                    for sub in category.subcategories
                ],
            )
            for category in CATEGORIES
        ],
        radius_options_m=list(RADIUS_OPTIONS_M),
        default_radius_m=DEFAULT_RADIUS_M,
        party_sizes=[ChoiceOption(code=code, label=label) for code, label in PARTY_SIZES],
        default_item_count=DEFAULT_ITEM_COUNT,
        max_item_count=MAX_ITEM_COUNT,
        basis="straight_line",
    )
