"""코스 추천의 정책값, 폼 옵션, 미리보기.

추천 Phase 1은 **직선거리 기준**이다. 실제 이동시간을 주는 카카오모빌리티 길찾기는 제휴
계약이 있어야 열려서, 기획서의 "10분 이내" 같은 이동시간 구간 대신 거리 반경을 받는다.
기획서도 직선거리를 최종 이동시간처럼 보여주지 말라고 정해 두었다
(docs/COURSE_RECOMMENDATION_SPEC.md 6.2절).

같은 이유로 예산·분위기·공간·이동수단은 받지 않는다. 카카오가 그 정보를 주지 않아서,
폼에 두면 골라도 결과가 바뀌지 않는 칸이 된다(2026-10-02 결정).

미리보기는 **계산만 한다.** 일정에 담는 것은 사용자가 결과를 보고 고른 뒤의 일이다.
"""

from decimal import Decimal

from app.places import service as places_service
from app.places.schemas import PROVIDER_KAKAO, PlaceSearchResultResponse
from app.recommendations.categories import CATEGORIES, ANY, Subcategory, find_subcategory, matches
from app.recommendations.course import Candidate, Course, build_courses
from app.recommendations.errors import (
    AreaNotFoundError,
    InvalidAnchorPlaceError,
    InvalidCategoryCombinationError,
)
from app.recommendations.schemas import (
    MAX_ITEM_COUNT,
    PARTY_SIZES,
    RADIUS_OPTIONS_M,
    CategoryOption,
    ChoiceOption,
    CourseCandidate,
    CourseCenter,
    CourseLeg,
    CoursePlace,
    CoursePreviewRequest,
    CoursePreviewResponse,
    RecommendationOptionsResponse,
    RelaxationSuggestion,
)
from app.schedules.models import Schedule
from app.schedules.optimization import Point, distance_m

DEFAULT_RADIUS_M = 1000

# 코스 항목 수(기획서 4.2절). 기본 3개, 최대는 schemas.MAX_ITEM_COUNT.
DEFAULT_ITEM_COUNT = 3

# 미리보기를 1분에 몇 번까지 받을지. 한 번에 카카오를 최대 19번 부른다(항목 6개 × 검색
# 최대 3개 + 지역 검색 1번). 사람이 조건을 바꿔 가며 다시 추천해도 1분에 10번은 넘기기
# 어렵고, 연타나 직접 호출은 여기서 막힌다.
PREVIEW_LIMIT_PER_MINUTE = 10

# 이 인원부터는 "수용 인원 확인 필요"를 붙인다. 1~2명은 어디든 들어가므로 붙이면 잡음이다.
LARGE_PARTY_SIZES = {"3-4", "5+"}

# 추천 장소마다 붙는 경고 코드.
WARNING_BUSINESS_HOURS = "BUSINESS_HOURS_UNVERIFIED"
WARNING_PARTY_SIZE = "PARTY_SIZE_UNVERIFIED"


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


# ── 미리보기 ──────────────────────────────────────────


def build_course_preview(schedule: Schedule, request: CoursePreviewRequest) -> CoursePreviewResponse:
    """조건에 맞는 코스를 몇 개 만들어 제안한다. 일정은 바뀌지 않는다.

    :param schedule: 장소가 함께 읽힌 일정. 기준 장소를 찾고, 이미 담긴 곳을 빼는 데 쓴다
    :param request: 추천 조건
    :raises InvalidCategoryCombinationError: 대분류와 소분류 조합이 틀린 항목이 있을 때
    :raises InvalidAnchorPlaceError: 기준 장소가 이 일정에 없거나 좌표가 없을 때
    :raises AreaNotFoundError: 지역 이름으로 위치를 찾지 못했을 때
    :raises PlaceSearchUnavailableError: 지도 공급자 호출에 실패했을 때

    순서: 조합 검증 → 중심 잡기 → 항목마다 후보 모으기 → 코스 엮기. 조합 검증을 맨 앞에
    두는 이유는, 틀린 요청 때문에 카카오 쿼터를 쓰지 않기 위해서다.
    """
    subcategories = _validate_items(request)

    anchor_place = None
    if request.anchor is not None:
        anchor_place = _find_anchor(schedule, request.anchor.schedule_place_id)
        center = CourseCenter(
            label=anchor_place.place.name,
            latitude=anchor_place.place.latitude,
            longitude=anchor_place.place.longitude,
        )
    else:
        center = _locate_area(request.area_query)

    # 이미 하루에 담은 곳은 추천하지 않는다. 이미 가기로 한 곳을 "추천"하면 쓸모가 없다.
    already_planned = {
        f"{item.place.provider}:{item.place.provider_place_id}"
        for item in schedule.places
        if item.place.provider_place_id
    }
    start = (float(center.latitude), float(center.longitude))
    slots = [
        _gather_candidates(sub, start, request.radius_m, already_planned)
        for sub in subcategories
    ]

    empty = [index for index, slot in enumerate(slots) if not slot]
    if empty:
        return CoursePreviewResponse(
            center=center,
            candidates=[],
            empty_item_indexes=empty,
            relaxation_suggestions=_suggest_relaxation(request, empty),
            basis="straight_line",
        )

    slots, exhausted = _exclude_shown(slots, set(request.exclude_place_keys))
    if exhausted and len(exhausted) == len(slots):
        # 모든 항목에서 새 후보가 바닥났다. 무엇을 엮어도 이미 보여준 코스라 새로 줄 게 없다.
        # 반경을 넓히거나 소분류를 풀면 새 후보가 생기므로 그 방법을 함께 알려준다.
        return CoursePreviewResponse(
            center=center,
            candidates=[],
            empty_item_indexes=[],
            exhausted_item_indexes=exhausted,
            relaxation_suggestions=_suggest_relaxation(request, exhausted),
            basis="straight_line",
        )

    build_backward = request.anchor is not None and request.anchor.position == "before"
    courses = build_courses(start, slots, build_backward=build_backward)

    candidates = [
        _to_candidate(course, request, anchor_place, center, build_backward)
        for course in courses
    ]
    # 짧은 코스가 먼저 오게 한다. 탐욕적 방식이라 첫 코스가 늘 가장 짧지는 않다.
    candidates.sort(key=lambda candidate: candidate.total_distance_m)
    for rank, candidate in enumerate(candidates, start=1):
        candidate.rank = rank

    return CoursePreviewResponse(
        center=center,
        candidates=candidates,
        empty_item_indexes=[],
        exhausted_item_indexes=exhausted,
        relaxation_suggestions=[],
        basis="straight_line",
    )


def _exclude_shown(
    slots: list[list[Candidate]], shown: set[str]
) -> tuple[list[list[Candidate]], list[int]]:
    """"다시 추천"을 위해, 이미 보여준 장소를 항목마다 뺀다.

    :param slots: 항목마다의 후보 (이미 하루에 담긴 곳은 빠져 있다)
    :param shown: 화면이 보낸, 지금까지 보여준 추천 장소의 place_key
    :return: (뺀 뒤의 항목별 후보, 새 후보가 바닥난 항목의 자리)

    **바닥난 항목은 이미 보여준 장소를 다시 쓴다.** 후보가 적은 항목(놀이공원은 동네에
    두세 곳뿐이다)이 한 번 만에 바닥나면, 다른 항목에 새 후보가 많아도 코스 전체가 안
    나오게 된다. 그 항목만 예전 장소를 쓰면 다른 항목이 새로워서 코스는 여전히 새 코스다.

    "이미 하루에 담긴 곳"과 다르게 다루는 이유: 담긴 곳은 다시 추천하면 쓸모가 없지만,
    보여준 곳은 사용자가 마음에 들어 했을 수도 있다. 다른 선택지가 없을 때 다시 보여주는
    것은 괜찮다.
    """
    if not shown:
        return slots, []

    result = []
    exhausted = []
    for index, slot in enumerate(slots):
        fresh = [candidate for candidate in slot if candidate.key not in shown]
        if fresh:
            result.append(fresh)
        else:
            exhausted.append(index)
            result.append(slot)
    return result, exhausted


def _validate_items(request: CoursePreviewRequest) -> list[Subcategory]:
    """항목마다 대분류·소분류 조합을 확인하고 소분류 정의를 돌려준다."""
    subcategories = []
    for index, item in enumerate(request.items):
        sub = find_subcategory(item.category, item.subcategory)
        if sub is None:
            raise InvalidCategoryCombinationError(index)
        subcategories.append(sub)
    return subcategories


def _find_anchor(schedule: Schedule, schedule_place_id: int):
    """이 일정 안에서만 기준 장소를 찾는다. 다른 일정의 장소는 없는 것으로 본다."""
    anchor = next((item for item in schedule.places if item.id == schedule_place_id), None)
    if anchor is None:
        raise InvalidAnchorPlaceError()
    if anchor.place.latitude is None or anchor.place.longitude is None:
        # 직접 입력한 장소는 좌표가 없다. 주변을 잴 기준점이 없다.
        raise InvalidAnchorPlaceError("주소가 없는 장소는 기준으로 쓸 수 없어요.")
    return anchor


def _locate_area(area_query: str) -> CourseCenter:
    """지역 이름을 좌표로 바꾼다.

    주소 검색이 아니라 **장소 검색**을 쓴다. 사람들은 "성수동"뿐 아니라 "홍대"나 "강남역"
    으로도 지역을 말하는데, 주소 검색은 "홍대"를 찾지 못한다. 장소 검색은 둘 다 찾는다.
    첫 결과의 좌표를 중심으로 삼는다.
    """
    result = places_service.search_places(area_query)
    located = next(
        (item for item in result.items if item.latitude is not None and item.longitude is not None),
        None,
    )
    if located is None:
        raise AreaNotFoundError()
    return CourseCenter(label=area_query, latitude=located.latitude, longitude=located.longitude)


def _candidate_key(item: PlaceSearchResultResponse) -> str:
    """같은 장소인지 가리는 값. 외부 id가 있으면 그것을, 없으면 이름과 좌표를 쓴다."""
    if item.provider_place_id:
        return f"{item.provider}:{item.provider_place_id}"
    return f"{item.name}|{item.latitude}|{item.longitude}"


def _gather_candidates(
    sub: Subcategory,
    start: tuple[float, float],
    radius_m: int,
    exclude_keys: set[str],
) -> list[Candidate]:
    """한 항목의 후보를 모은다.

    **정확도 순으로 받는다.** 가게가 몰린 동네에서 가까운 순으로 받으면 15곳이 전부
    100m 안에 몰려, 반경을 넓혀도 같은 곳이 나온다.

    업종 거름망은 카카오 결과에만 건다. 거름망이 카카오 업종 경로로 쓰여 있어서, 업종
    경로가 없는 개발용 mock 결과에 걸면 전부 떨어져 화면을 만들 수 없게 된다.
    """
    center = Point(0, start[0], start[1])
    found: dict[str, Candidate] = {}

    for search in sub.searches:
        results = places_service.search_nearby_places(
            latitude=Decimal(str(start[0])),
            longitude=Decimal(str(start[1])),
            radius_m=radius_m,
            keyword=search.keyword,
            category_group=search.category_group,
            sort="accuracy",
        )
        for item in results:
            if item.latitude is None or item.longitude is None:
                continue
            if item.provider == PROVIDER_KAKAO and not matches(search, item.category):
                continue
            # 공급자가 반경을 지키지만, 화면에 "1km 안"이라고 말하는 쪽은 우리라 한 번 더 확인한다.
            point = Point(0, float(item.latitude), float(item.longitude))
            if distance_m(center, point) > radius_m:
                continue
            key = _candidate_key(item)
            if key in exclude_keys or key in found:
                continue
            found[key] = Candidate(
                key=key,
                latitude=float(item.latitude),
                longitude=float(item.longitude),
                payload=item,
            )

    return list(found.values())


def _suggest_relaxation(request: CoursePreviewRequest, empty: list[int]) -> list[RelaxationSuggestion]:
    """비어 버린 항목을 살릴 방법을 제안한다(기획서 13절).

    반경은 한 단계만 넓혀 제안한다. 한 번에 5km를 권하면 코스가 동네를 벗어난다.
    """
    suggestions = []
    wider = [radius for radius in RADIUS_OPTIONS_M if radius > request.radius_m]
    if wider:
        suggestions.append(RelaxationSuggestion(code="WIDEN_RADIUS", radius_m=wider[0]))
    for index in empty:
        if request.items[index].subcategory != ANY:
            suggestions.append(RelaxationSuggestion(code="USE_ANY_SUBCATEGORY", item_index=index))
    return suggestions


def _format_distance(meters: float) -> str:
    """화면과 같은 규칙으로 거리를 적는다. 1km 미만은 10m 단위, 넘으면 소수 한 자리."""
    if meters < 1000:
        return f"{round(meters / 10) * 10}m"
    return f"{meters / 1000:.1f}km"


def _to_candidate(
    course: Course,
    request: CoursePreviewRequest,
    anchor_place,
    center: CourseCenter,
    build_backward: bool,
) -> CourseCandidate:
    """엮은 코스를 응답 모양으로 바꾼다. 기준 장소가 있으면 앞이나 뒤에 끼운다.

    추천 이유는 **그 장소를 고른 근거가 된 이웃**과의 거리로 쓴다. 기준 장소 뒤로 엮을 때는
    앞 장소, 앞으로 엮을 때는 다음 장소가 근거다.
    """
    warnings = [WARNING_BUSINESS_HOURS]
    if request.party_size in LARGE_PARTY_SIZES:
        warnings.append(WARNING_PARTY_SIZE)

    recommended = [
        _recommended_place(candidate, index, request, warnings)
        for index, candidate in enumerate(course.picks)
    ]

    if anchor_place is None:
        places = recommended
    else:
        anchor = CoursePlace(
            kind="anchor",
            schedule_place_id=anchor_place.id,
            name=anchor_place.place.name,
            address=anchor_place.place.address,
            latitude=anchor_place.place.latitude,
            longitude=anchor_place.place.longitude,
            provider=anchor_place.place.provider,
            provider_place_id=anchor_place.place.provider_place_id,
        )
        places = recommended + [anchor] if build_backward else [anchor] + recommended

    points = [Point(0, float(place.latitude), float(place.longitude)) for place in places]
    legs = [
        CourseLeg(
            from_index=index,
            to_index=index + 1,
            distance_m=round(distance_m(points[index], points[index + 1])),
        )
        for index in range(len(points) - 1)
    ]

    _write_reasons(places, legs, anchor_place, center, build_backward)

    return CourseCandidate(
        rank=0,
        total_distance_m=sum(leg.distance_m for leg in legs),
        places=places,
        legs=legs,
    )


def _recommended_place(
    candidate: Candidate, index: int, request: CoursePreviewRequest, warnings: list[str]
) -> CoursePlace:
    item: PlaceSearchResultResponse = candidate.payload
    return CoursePlace(
        kind="recommended",
        item_index=index,
        # 코스 엮기에서 같은 장소를 가린 바로 그 값이다. 화면이 다시 추천할 때 돌려보낸다.
        place_key=candidate.key,
        category=request.items[index].category,
        subcategory=request.items[index].subcategory,
        name=item.name,
        address=item.address,
        latitude=item.latitude,
        longitude=item.longitude,
        provider=item.provider,
        provider_place_id=item.provider_place_id,
        phone=item.phone,
        reason_codes=["CATEGORY_MATCH"],
        warnings=list(warnings),
    )


def _write_reasons(
    places: list[CoursePlace],
    legs: list[CourseLeg],
    anchor_place,
    center: CourseCenter,
    build_backward: bool,
) -> None:
    """추천 장소마다 이유 문구를 단다. 틀은 셋뿐이다.

    - 기준 장소 옆: "○○에서 직선 350m" / "○○까지 직선 350m"
    - 그 밖의 이웃: "앞 장소에서 직선 …" / "다음 장소까지 직선 …"
    - 기준 장소 없이 첫 장소: "○○ 중심에서 직선 …"

    문구에 늘 "직선"을 넣는다. 실제 걷는 길로 오해하면 "왜 이렇게 멀지?"를 설명할 수 없다.
    """
    for position, place in enumerate(places):
        if place.kind != "recommended":
            continue

        neighbor = position + 1 if build_backward else position - 1
        if 0 <= neighbor < len(places):
            leg = legs[min(position, neighbor)]
            gap = _format_distance(leg.distance_m)
            neighbor_place = places[neighbor]
            if neighbor_place.kind == "anchor":
                verb = "까지" if build_backward else "에서"
                place.reason = f"{neighbor_place.name}{verb} 직선 {gap}"
                place.reason_codes.append("NEAR_ANCHOR")
            else:
                place.reason = (
                    f"다음 장소까지 직선 {gap}" if build_backward else f"앞 장소에서 직선 {gap}"
                )
                place.reason_codes.append("NEAR_NEIGHBOR")
        else:
            # 기준 장소 없이 지역 중심에서 출발한 첫 장소
            gap = _format_distance(
                distance_m(
                    Point(0, float(center.latitude), float(center.longitude)),
                    Point(0, float(place.latitude), float(place.longitude)),
                )
            )
            place.reason = f"{center.label} 중심에서 직선 {gap}"
            place.reason_codes.append("NEAR_AREA_CENTER")
