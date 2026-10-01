"""코스 추천 API의 요청/응답 스키마."""

from typing import Literal

from pydantic import BaseModel


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
