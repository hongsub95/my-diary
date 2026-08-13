"""장소 검색 공급자 어댑터.

지도 공급자는 아직 확정 전이다. 카카오가 유력하지만 기술 검증이 남아 있어
(docs/COURSE_RECOMMENDATION_SPEC.md 9.4절), 그때까지는 mock으로 동작한다.

어댑터로 분리해 두는 이유 (docs/API_SPEC.md 공급자 어댑터 요구사항):

- 공급자의 원본 응답과 오류를 프론트엔드에 그대로 전달하지 않는다. 공급자를 바꾸면
  클라이언트가 함께 깨지고, 키·쿼터 같은 내부 사정이 노출된다.
- 공급자를 바꿀 때 라우터와 서비스는 건드리지 않는다. 설정값 하나만 바꾸면 된다.

카카오를 붙일 때 할 일:

1. `KakaoPlaceSearchProvider`를 이 파일에 추가한다 (Protocol만 만족하면 된다).
2. `PROVIDERS`에 등록한다.
3. `.env`에 `PLACE_SEARCH_PROVIDER=kakao`와 REST API 키를 넣는다.
"""

from decimal import Decimal
from typing import Protocol

from app.places.schemas import PROVIDER_KAKAO, PROVIDER_MANUAL, PlaceSearchResultResponse


class PlaceSearchProvider(Protocol):
    """장소 검색 공급자가 만족해야 하는 인터페이스.

    경로 계산(길찾기)은 여기 넣지 않는다. 명세가 검색과 경로를 별도 인터페이스로
    분리하도록 요구하며, 카카오는 두 기능의 키·약관·쿼터가 서로 다르다.
    """

    # 응답의 provider 필드에 실릴 이름
    name: str

    def search(self, query: str, limit: int) -> list[PlaceSearchResultResponse]:
        """키워드로 장소를 찾는다.

        :param query: 검색어 (공백 정리 완료)
        :param limit: 최대 결과 수
        :return: 공통 형태로 변환된 검색 결과
        """
        ...


class MockPlaceSearchProvider:
    """실제 지도 API를 붙이기 전에 쓰는 가짜 공급자.

    프론트엔드가 검색 화면을 먼저 만들 수 있도록 **응답 구조는 실제와 동일하게** 준다.
    검색어를 이름에 섞어 돌려주므로 화면에서 입력이 반영되는 것도 확인할 수 있다.

    provider를 'manual'로 두는 이유: 여기서 나온 장소를 일정에 추가하면 DB에
    저장되는데, 'kakao'로 표시하면 나중에 진짜 카카오 데이터와 섞여 구분할 수 없다.
    provider_place_id도 주지 않아 중복 제거 대상에서 빠진다.
    """

    name = "mock"

    # 서울 주요 지역의 실제 좌표. 지도에 찍었을 때 엉뚱한 곳이 나오지 않도록
    # 그럴듯한 값을 쓴다.
    _SAMPLES = (
        ("성수동", "서울 성동구 성수이로", Decimal("37.544579"), Decimal("127.055966"), "카페"),
        ("연남동", "서울 마포구 연남로", Decimal("37.560056"), Decimal("127.925270"), "음식점"),
        ("서촌", "서울 종로구 자하문로", Decimal("37.579617"), Decimal("126.970001"), "문화시설"),
        ("한강공원", "서울 영등포구 여의동로", Decimal("37.528250"), Decimal("126.932598"), "공원"),
        ("을지로", "서울 중구 을지로", Decimal("37.566295"), Decimal("126.991561"), "술집"),
    )

    def search(self, query: str, limit: int) -> list[PlaceSearchResultResponse]:
        """검색어를 붙인 가짜 결과를 돌려준다."""
        results = [
            PlaceSearchResultResponse(
                name=f"{area} {query}",
                address=f"{address} {index * 10 + 1}",
                latitude=latitude,
                longitude=longitude,
                provider=PROVIDER_MANUAL,
                provider_place_id=None,
                category=category,
                phone=None,
            )
            for index, (area, address, latitude, longitude, category) in enumerate(self._SAMPLES)
        ]
        return results[:limit]


# 설정값(PLACE_SEARCH_PROVIDER)으로 고를 수 있는 공급자들.
# 카카오 어댑터를 만들면 여기에 PROVIDER_KAKAO 항목을 추가한다.
PROVIDERS: dict[str, PlaceSearchProvider] = {
    MockPlaceSearchProvider.name: MockPlaceSearchProvider(),
}

# 아직 구현되지 않았지만 설정값으로 지정될 수 있는 이름. 오타와 구분해 안내하기 위해 둔다.
NOT_YET_IMPLEMENTED = (PROVIDER_KAKAO,)


def get_provider(name: str) -> PlaceSearchProvider:
    """설정값에 해당하는 공급자를 돌려준다.

    :param name: PLACE_SEARCH_PROVIDER 설정값
    :raises ValueError: 없는 공급자 이름일 때

    앱 시작 시점이 아니라 호출 시점에 확인한다. 설정 오타 때문에 서버 전체가 못 뜨는
    것보다, 장소 검색만 실패하고 나머지 API는 동작하는 편이 낫다.
    """
    provider = PROVIDERS.get(name)
    if provider is not None:
        return provider

    if name in NOT_YET_IMPLEMENTED:
        raise ValueError(
            f"'{name}' 장소 검색 공급자는 아직 구현되지 않았습니다. "
            f"app/places/providers.py에 어댑터를 추가하세요."
        )
    raise ValueError(
        f"알 수 없는 장소 검색 공급자입니다: '{name}'. "
        f"사용 가능: {', '.join(sorted(PROVIDERS))}"
    )
