"""코스 엮기 — 항목마다 모은 후보로 서로 다른 코스 몇 개를 만든다.

**항목 순서는 바꾸지 않는다.** 사용자가 "카페 → 저녁 → 술"로 정했다면 그 순서에 뜻이
있다. 순서까지 거리로 섞는 것은 순서 다듬기(app/schedules/optimization.py)의 몫이고,
그쪽도 제안만 한다.

방식은 탐욕적(greedy)이다. 출발점에서 첫 항목 후보 중 가장 가까운 곳, 거기서 다음 항목
후보 중 가장 가까운 곳 … 으로 이어 붙인다. 항목 수가 최대 6개라 비용은 후보 수 × 항목 수
정도로 작다. 가장 짧은 조합을 보장하지는 않지만, 코스는 사람이 보고 고르는 제안이라
"충분히 가까운" 코스 몇 개가 하나의 최적 코스보다 쓸모 있다.

이 모듈은 DB와 HTTP를 모른다. 후보와 좌표만 받아 테스트에서 바로 확인할 수 있다.
"""

from dataclasses import dataclass, field

from app.schedules.optimization import Point, distance_m

# 한 번에 제안할 코스 수(기획서 7.4절, 기본 3개).
MAX_COURSES = 3


@dataclass(frozen=True)
class Candidate:
    """코스에 들어갈 수 있는 장소 하나.

    :param key: 같은 장소인지 가리는 값. 한 코스에 같은 곳이 두 번 들어가지 않게 한다
    :param latitude: 위도
    :param longitude: 경도
    :param payload: 결과에 실을 원본. 이 모듈은 들여다보지 않는다
    """

    key: str
    latitude: float
    longitude: float
    payload: object = field(compare=False, hash=False)


@dataclass(frozen=True)
class Course:
    """완성된 코스 하나. picks는 항목 순서 그대로다."""

    picks: tuple[Candidate, ...]


def _distance(a: tuple[float, float], b: Candidate) -> float:
    return distance_m(Point(0, a[0], a[1]), Point(0, b.latitude, b.longitude))


def build_courses(
    start: tuple[float, float],
    slots: list[list[Candidate]],
    *,
    build_backward: bool = False,
    limit: int = MAX_COURSES,
) -> list[Course]:
    """서로 다른 코스를 최대 limit개 만든다.

    :param start: 출발점 (위도, 경도). 기준 장소나 지역 중심
    :param slots: 항목마다의 후보 목록. 항목 순서대로
    :param build_backward: 기준 장소 **앞에** 붙는 코스면 True. 기준 장소에서 마지막
        항목부터 거꾸로 이어 붙인다. 그래야 기준 장소 바로 앞 장소가 기준 장소와 가깝다
    :param limit: 최대 코스 수
    :return: 만든 코스들. 후보가 비는 항목이 있으면 빈 목록

    **두 번째 코스부터는 앞 코스가 그 항목에 쓴 장소를 피한다.** 그대로 두면 탐욕적
    방식은 매번 같은 답을 내서, 코스 세 개가 모두 같아진다. 어떤 항목에 새 후보가 다
    떨어지면 그 항목만 앞에서 쓴 장소를 다시 쓴다. 그 결과가 이미 만든 코스와 똑같으면
    더 만들 수 있는 다른 코스가 없다는 뜻이라 멈춘다.
    """
    if not slots or any(not slot for slot in slots):
        return []

    order = list(range(len(slots)))
    if build_backward:
        order.reverse()

    used_by_slot: list[set[str]] = [set() for _ in slots]
    seen: set[tuple[str, ...]] = set()
    courses: list[Course] = []

    for _ in range(limit):
        picks: dict[int, Candidate] = {}
        # 한 코스 안의 중복은 늘 막는다. 브런치 카페가 "카페"와 "식사" 양쪽에 걸리는 식으로
        # 한 장소가 두 항목에 후보로 오를 수 있다(기획서 13절).
        taken: set[str] = set()
        previous = start

        for index in order:
            fresh = [
                c for c in slots[index] if c.key not in taken and c.key not in used_by_slot[index]
            ]
            pool = fresh or [c for c in slots[index] if c.key not in taken]
            if not pool:
                return courses
            choice = min(pool, key=lambda candidate: _distance(previous, candidate))
            picks[index] = choice
            taken.add(choice.key)
            previous = (choice.latitude, choice.longitude)

        ordered = tuple(picks[index] for index in range(len(slots)))
        signature = tuple(candidate.key for candidate in ordered)
        if signature in seen:
            break
        seen.add(signature)
        courses.append(Course(picks=ordered))
        for index, candidate in enumerate(ordered):
            used_by_slot[index].add(candidate.key)

    return courses
