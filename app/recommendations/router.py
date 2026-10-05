"""코스 추천 엔드포인트."""

from fastapi import APIRouter

from app.auth.dependencies import CurrentUser, RedisClient
from app.core import rate_limit
from app.recommendations import service
from app.recommendations.schemas import (
    CoursePreviewRequest,
    CoursePreviewResponse,
    RecommendationOptionsResponse,
)
from app.schedules.dependencies import ScheduleMemberContext

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


@router.post(
    "/schedules/{schedule_id}/course-recommendations/preview",
    response_model=CoursePreviewResponse,
    summary="코스 추천 미리보기",
    description=(
        "기준 장소(이 하루에 담긴 장소)나 지역 주변에서, 고른 항목 순서대로 코스를 최대 3개 "
        "만들어 **제안만 한다.** 일정은 바뀌지 않는다. 담으려면 고른 코스의 추천 장소를 "
        "장소 추가 API로 보낸다. **직선거리 기준이다.** 항목 순서는 바꾸지 않는다. "
        "후보가 없는 항목이 있으면 200과 빈 candidates, empty_item_indexes, 완화 제안을 준다. "
        "사용자마다 1분에 10번까지 받고, 넘으면 429 `TOO_MANY_REQUESTS`다."
    ),
)
def course_preview(
    payload: CoursePreviewRequest,
    context: ScheduleMemberContext,
    current_user: CurrentUser,
    redis_client: RedisClient,
) -> CoursePreviewResponse:
    """코스 추천 미리보기.

    일정 아래에 둔 이유: 추천은 특정 하루에 담을 장소를 찾는 일이라, 기준 장소가 그
    하루에 있는지 확인하고 이미 담긴 곳을 빼려면 일정을 알아야 한다. 일정 경로 아래에
    두면 멤버 확인도 다른 일정 API와 같은 방식으로 끝난다.

    호출 제한은 의존성이 아니라 여기서 센다. 본문 검증과 멤버 확인을 통과한 요청만 세야,
    잘못 보낸 요청이나 남의 일정을 두드린 요청으로 정상 사용자의 횟수가 깎이지 않는다.
    """
    rate_limit.enforce(
        redis_client,
        "course-preview",
        current_user.id,
        limit=service.PREVIEW_LIMIT_PER_MINUTE,
    )
    return service.build_course_preview(context.schedule, payload)

