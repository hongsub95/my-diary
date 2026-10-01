"""코스 추천 엔드포인트."""

from fastapi import APIRouter

from app.auth.dependencies import CurrentUser
from app.recommendations import service
from app.recommendations.schemas import RecommendationOptionsResponse

router = APIRouter(tags=["recommendations"])


@router.get(
    "/recommendation-options",
    response_model=RecommendationOptionsResponse,
    summary="코스 추천 폼 옵션",
    description=(
        "대분류·소분류, 반경, 인원 구간, 코스 항목 수를 내려준다. "
        "소분류는 대분류 안에 들어 있어 다른 대분류의 소분류를 고를 수 없다. "
        "Phase 1은 직선거리 기준이라 이동수단·이동시간 구간은 없다."
    ),
)
def get_options(current_user: CurrentUser) -> RecommendationOptionsResponse:
    """추천 폼 옵션.

    로그인을 요구한다. 내용은 누구에게나 같지만, 추천은 하루에 붙는 기능이라 로그인 전에
    볼 화면이 없다.
    """
    return service.build_options()
