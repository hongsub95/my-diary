"""담은 장소의 방문 순서를 거리 기준으로 다시 배열한다.

**직선거리로 계산한다.** 실제 도로·도보 경로가 아니다. 경로와 이동시간을 주는
카카오모빌리티 길찾기 API는 사전 제휴 계약이 있어야 열리는데, 아직 없다
(docs/COURSE_RECOMMENDATION_SPEC.md 9절). 직선거리로도 "가까운 것끼리 묶는" 목적은
대체로 달성되고, 나중에 경로 API가 열리면 거리 계산 함수만 갈아끼우면 된다.

**시간 흐름은 고려하지 않는다.** 거리만 보기 때문에 "카페 → 저녁 → 술"처럼 순서에
뜻이 있는 하루를 뒤섞을 수 있다. 그래서 결과를 바로 적용하지 않고 **미리보기로
제안**하며, 첫 장소는 고정한다(아래).
"""

from math import asin, cos, radians, sin, sqrt

# 지구 반지름(m). 하버사인 공식에 쓴다.
EARTH_RADIUS_M = 6_371_000

# 이 정도 차이는 제안하지 않는다. 몇십 미터 줄이자고 순서를 흔들면 사용자는 무엇이
# 나아졌는지 알 수 없고, 계산 오차로 매번 다른 제안이 나오는 것처럼 보인다.
MIN_IMPROVEMENT_M = 100


class Point:
    """최적화에 쓰는 최소 정보. 모델에 의존하지 않아 테스트에서 그대로 만들 수 있다."""

    def __init__(self, place_id: int, latitude: float, longitude: float) -> None:
        self.place_id = place_id
        self.latitude = latitude
        self.longitude = longitude


def distance_m(a: Point, b: Point) -> float:
    """두 지점의 직선거리(m).

    하버사인 공식이다. 위도·경도 차이를 평면처럼 빼서 계산하면 위도가 높아질수록
    경도 1도의 실제 길이가 짧아지는 것을 놓쳐 오차가 커진다.
    """
    lat1, lon1, lat2, lon2 = map(radians, (a.latitude, a.longitude, b.latitude, b.longitude))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(h))


def total_distance_m(points: list[Point]) -> float:
    """이 순서로 돌 때의 전체 직선거리 합."""
    return sum(distance_m(points[i], points[i + 1]) for i in range(len(points) - 1))


def _nearest_neighbor(points: list[Point]) -> list[Point]:
    """가장 가까운 곳을 차례로 이어 붙인다.

    첫 장소는 고정한다. 대개 만나는 곳이고, 거기서 출발한다는 전제가 있어야 결과가
    사람이 납득할 모양이 된다. 시작점까지 바꾸면 "왜 저기서 시작하지?"가 된다.
    """
    remaining = points[1:]
    ordered = [points[0]]

    while remaining:
        current = ordered[-1]
        nearest = min(remaining, key=lambda point: distance_m(current, point))
        remaining.remove(nearest)
        ordered.append(nearest)

    return ordered


def _two_opt(points: list[Point]) -> list[Point]:
    """구간을 뒤집어 보며 더 짧아지면 받아들인다 (2-opt).

    가까운 곳만 따라가는 방식은 마지막에 멀리 떨어진 한 곳이 남아 되돌아가는 경로를
    자주 만든다. 구간 뒤집기로 그 교차를 펴 준다.

    첫 장소는 여기서도 고정이라 i는 1부터 본다.

    **전체 길이를 다시 재지 않고 바뀐 두 변만 본다.** 구간 [i, j]를 뒤집으면 실제로
    달라지는 것은 (i-1, i)와 (j, j+1) 두 변뿐이다. 나머지는 순서만 뒤집힐 뿐 길이가
    같다. 전체를 다시 재면 후보마다 O(n)이 붙어 한 번 훑는 데 O(n^3)이 되는데,
    변 두 개만 보면 O(n^2)로 끝난다.

    장소 수에 상한이 없어서(사진과 달리 개수 제한을 두지 않았다) 이 차이가 실제로
    의미가 있다. 한 하루에 수십 곳을 담는 사람은 드물지만, 비용이 장소 수의 세제곱으로
    늘어나는 코드를 열어 둘 이유는 없다.
    """
    best = points[:]
    improved = True

    while improved:
        improved = False
        for i in range(1, len(best) - 1):
            for j in range(i + 1, len(best)):
                before = best[i - 1]
                first, last = best[i], best[j]
                # 뒤집으면 (i-1 → i)가 (i-1 → j)로, (j → j+1)이 (i → j+1)로 바뀐다.
                removed = distance_m(before, first)
                added = distance_m(before, last)
                if j + 1 < len(best):
                    after = best[j + 1]
                    removed += distance_m(last, after)
                    added += distance_m(first, after)

                if added < removed - 1e-9:
                    best[i : j + 1] = best[i : j + 1][::-1]
                    improved = True

    return best


def optimize(points: list[Point]) -> list[Point]:
    """거리 기준으로 다시 배열한 순서를 돌려준다.

    :param points: 좌표가 있는 장소들. 원래 순서대로 들어온다
    :return: 다시 배열한 순서. 두 곳 이하면 바꿀 것이 없어 그대로 돌려준다

    **외판원 문제(TSP)의 휴리스틱 두 가지를 이어 쓴다.** 최적해를 구하는 것이 아니라
    충분히 짧은 순서를 빠르게 찾는다 — 최적해는 장소가 늘면 현실적인 시간에 못 구한다.

    | 단계 | 이름 | 비용 |
    |---|---|---|
    | 만들기 | 최근접 이웃 (nearest neighbor) | O(n^2) |
    | 다듬기 | 2-opt (한 번 훑을 때) | O(n^2) |

    2-opt는 더 나아지지 않을 때까지 반복하므로 전체는 O(k · n^2)다. k는 개선이 일어난
    횟수이고 이론상 상한이 크지만, 실제로는 몇 번 안에 멈춘다.

    시작점을 돌아오지 않는 열린 경로(open path)로 푼다. 하루의 마지막 장소에서 집으로
    돌아가는 거리는 사람마다 달라서 계산에 넣을 근거가 없다.
    """
    if len(points) <= 2:
        return points[:]
    return _two_opt(_nearest_neighbor(points))
