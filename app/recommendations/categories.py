"""코스 추천의 카테고리 체계와 카카오 검색 조건.

화면에는 제품 내부 코드(`food > korean`)만 보이고, 카카오 업종 이름은 보이지 않는다
(docs/COURSE_RECOMMENDATION_SPEC.md 5절). 공급자를 바꾸면 이 파일의 검색 조건만 바꾸고
화면과 API 계약은 그대로 둔다.

**검색 조건은 책상에서 정하지 않고 실제 카카오로 재서 정했다.** 2026-10-02 성수·홍대·
광화문 반경 2km에서 소분류마다 검색해 본 결과, 검색어만 넣으면 엉뚱한 업종이 많이
섞였다. 예를 들어 "한강공원"은 출입구와 화장실이, "쇼핑몰"은 통신판매업체가 대부분이었다.
그래서 검색 결과를 카카오 업종 경로로 한 번 더 거른다(require / exclude).

기획서에 있지만 뺀 것:

- `event`(행사·축제) 대분류 — 카카오는 상설 장소 위주라 결과가 거의 없다. 축제 데이터
  공급자를 정할 때 다시 넣는다.
- 스포츠 — 거르고 나면 헬스장만 남았다.
- 야경 명소, 팝업스토어 — 카카오 업종이 아니다. 세 지역 모두 0건이거나 마케팅
  대행사가 나왔다. 야경은 장소 종류가 아니라 속성(태그)에 가깝다.
"""

from dataclasses import dataclass

# 소분류 "상관없음"의 코드. 모든 대분류가 가진다(기획서 5절).
ANY = "any"

# 카카오 카테고리 그룹 코드. 카카오 로컬 API 문서의 값이다.
KAKAO_FOOD = "FD6"
KAKAO_CAFE = "CE7"
KAKAO_CULTURE = "CT1"
KAKAO_ATTRACTION = "AT4"


@dataclass(frozen=True)
class KakaoSearch:
    """카카오에 한 번 던질 검색 조건과, 돌아온 결과를 거를 업종 경로.

    :param keyword: 검색어. 없으면 카테고리 그룹만으로 찾는다
    :param category_group: 카카오 카테고리 그룹 코드
    :param require: 이 중 하나로 시작하는 업종만 남긴다. 비어 있으면 거르지 않는다
    :param exclude: 이 중 하나로 시작하는 업종은 뺀다

    경로는 카카오의 `category_name` 형식(`음식점 > 한식 > 육류,고기`)으로 적는다.
    """

    keyword: str | None = None
    category_group: str | None = None
    require: tuple[str, ...] = ()
    exclude: tuple[str, ...] = ()


@dataclass(frozen=True)
class Subcategory:
    """소분류 하나.

    :param code: 화면과 API가 쓰는 코드. 바꾸지 않는다
    :param label: 사용자에게 보일 이름
    :param searches: 후보를 모을 검색들. 대개 하나이고, 카카오에 맞는 그룹이 없는
        "상관없음"만 대표 소분류 몇 개를 합쳐 쓴다
    """

    code: str
    label: str
    searches: tuple[KakaoSearch, ...]


@dataclass(frozen=True)
class Category:
    """대분류 하나. 첫 소분류는 늘 "상관없음"이다."""

    code: str
    label: str
    subcategories: tuple[Subcategory, ...]


def _sub(code: str, label: str, *searches: KakaoSearch) -> Subcategory:
    return Subcategory(code=code, label=label, searches=searches)


def _food(code: str, label: str) -> Subcategory:
    """식사 소분류. 업종 경로가 검색어와 같은 이름이라 그 경로만 남긴다.

    "일식"을 그냥 찾으면 이자카야(카카오 분류상 술집)가 섞이고, "뷔페"는 회사 구내식당이
    섞였다. 자기 경로만 남기면 둘 다 빠진다.
    """
    return _sub(
        code,
        label,
        KakaoSearch(keyword=label, category_group=KAKAO_FOOD, require=(f"음식점 > {label}",)),
    )


def _bar(code: str, label: str, keyword: str | None = None) -> Subcategory:
    """술·야간 소분류. 포차·칵테일바를 찾으면 한식·양식 식당이 몇 곳씩 섞여 술집만 남긴다."""
    return _sub(
        code,
        label,
        KakaoSearch(
            keyword=keyword or label, category_group=KAKAO_FOOD, require=("음식점 > 술집",)
        ),
    )


# ── 대분류별 정의 ─────────────────────────────────────

_WORKSHOP = KakaoSearch(keyword="공방", require=("문화,예술 > 미술,공예",))
_ESCAPE_ROOM = KakaoSearch(keyword="방탈출")
_BOARD_GAME = KakaoSearch(keyword="보드게임카페")
_MALL = KakaoSearch(
    keyword="복합쇼핑몰",
    require=("가정,생활 > 복합쇼핑몰", "가정,생활 > 백화점", "가정,생활 > 아울렛"),
)
_DEPARTMENT_STORE = KakaoSearch(
    keyword="백화점", require=("가정,생활 > 백화점", "가정,생활 > 복합쇼핑몰")
)
_MARKET = KakaoSearch(keyword="전통시장", require=("가정,생활 > 시장",))
_PROP_SHOP = KakaoSearch(keyword="소품샵", require=("가정,생활",))

CATEGORIES: tuple[Category, ...] = (
    Category(
        code="food",
        label="식사",
        subcategories=(
            # 음식점 그룹에는 술집·카페·간식이 함께 들어 있다. "밥 먹을 곳"만 남긴다.
            _sub(
                ANY,
                "상관없음",
                KakaoSearch(
                    category_group=KAKAO_FOOD,
                    exclude=("음식점 > 술집", "음식점 > 카페", "음식점 > 간식", "음식점 > 구내식당"),
                ),
            ),
            _food("korean", "한식"),
            _food("japanese", "일식"),
            _food("chinese", "중식"),
            _food("western", "양식"),
            _food("snack", "분식"),
            _food("buffet", "뷔페"),
        ),
    ),
    Category(
        code="cafe",
        label="카페·디저트",
        subcategories=(
            # 카페 그룹에 방탈출·보드게임 카페(여가시설)가 몇 곳 섞여 있어 카페만 남긴다.
            _sub(ANY, "상관없음", KakaoSearch(category_group=KAKAO_CAFE, require=("음식점 > 카페",))),
            _sub("coffee", "일반 카페", KakaoSearch(keyword="커피", category_group=KAKAO_CAFE, require=("음식점 > 카페",))),
            # 베이커리는 카카오에서 카페가 아니라 "음식점 > 간식"이다. 그룹을 걸면 다 빠진다.
            _sub("bakery", "베이커리", KakaoSearch(keyword="베이커리", require=("음식점 > 간식", "음식점 > 카페"))),
            _sub("dessert", "디저트", KakaoSearch(keyword="디저트카페", category_group=KAKAO_CAFE)),
            # 브런치는 카페와 양식에 고루 걸쳐 있어 음식점 전체를 허용한다.
            _sub("brunch", "브런치", KakaoSearch(keyword="브런치", require=("음식점",))),
            _sub("theme", "테마 카페", KakaoSearch(keyword="테마카페", category_group=KAKAO_CAFE)),
        ),
    ),
    Category(
        code="bar",
        label="술·야간",
        subcategories=(
            _bar(ANY, "상관없음", keyword="술집"),
            _bar("izakaya", "이자카야"),
            _bar("pocha", "포차"),
            _bar("pub", "펍"),
            _bar("wine", "와인바"),
            _bar("cocktail", "칵테일바"),
        ),
    ),
    Category(
        code="culture",
        label="문화·관람",
        subcategories=(
            _sub(ANY, "상관없음", KakaoSearch(category_group=KAKAO_CULTURE)),
            _sub("exhibition", "전시관", KakaoSearch(keyword="전시", category_group=KAKAO_CULTURE)),
            _sub("gallery", "미술관", KakaoSearch(keyword="미술관", category_group=KAKAO_CULTURE)),
            _sub("museum", "박물관", KakaoSearch(keyword="박물관", category_group=KAKAO_CULTURE)),
            _sub("performance", "공연장", KakaoSearch(keyword="공연장", category_group=KAKAO_CULTURE)),
            _sub("cinema", "영화관", KakaoSearch(keyword="영화관", category_group=KAKAO_CULTURE)),
        ),
    ),
    Category(
        code="activity",
        label="체험·놀이",
        subcategories=(
            # 체험·놀이를 묶는 카카오 그룹이 없다. "체험"으로 찾으면 어린이 체험학습장이
            # 나와서, 데이트에 흔한 소분류 셋을 합쳐 후보로 쓴다.
            _sub(ANY, "상관없음", _WORKSHOP, _ESCAPE_ROOM, _BOARD_GAME),
            _sub("theme_park", "놀이공원", KakaoSearch(keyword="놀이공원")),
            _sub("workshop", "공방", _WORKSHOP),
            _sub("escape_room", "방탈출", _ESCAPE_ROOM),
            _sub("board_game", "보드게임", _BOARD_GAME),
            _sub("bowling", "볼링", KakaoSearch(keyword="볼링장", require=("스포츠,레저 > 볼링",))),
        ),
    ),
    Category(
        code="outdoor",
        label="야외·산책",
        subcategories=(
            # 관광명소 그룹은 테마거리·도보여행 코스가 대부분이라 "걸을 만한 곳"에 맞는다.
            _sub(ANY, "상관없음", KakaoSearch(category_group=KAKAO_ATTRACTION)),
            # 그냥 찾으면 출입구·화장실이 대부분이다. 강변이 아니면 비는 것이 정상이다.
            _sub(
                "hangang_park",
                "한강공원",
                KakaoSearch(keyword="한강공원", require=("여행 > 공원", "여행 > 관광,명소")),
            ),
            # "여행 > 공원"만 남기면 편의점·화장실이 빠진다. 칸 단위로 비교해서
            # "여행 > 공원시설물"(주차장·화장실)도 걸리지 않는다.
            _sub("park", "일반 공원", KakaoSearch(keyword="공원", require=("여행 > 공원",))),
            _sub("trail", "산책로", KakaoSearch(keyword="산책로", require=("여행",))),
            _sub("arboretum", "수목원", KakaoSearch(keyword="수목원")),
            # 해안 지역에서만 나온다. 서울에서 비는 것은 정상이다.
            _sub("beach", "해변", KakaoSearch(keyword="해수욕장")),
        ),
    ),
    Category(
        code="shopping",
        label="쇼핑·구경",
        subcategories=(
            _sub(ANY, "상관없음", _MALL, _MARKET, _PROP_SHOP),
            # "쇼핑몰"로 찾으면 통신판매업체가 40건 중 대부분이었다. 복합쇼핑몰·백화점으로 찾는다.
            _sub("mall", "쇼핑몰", _MALL, _DEPARTMENT_STORE),
            # "시장"은 시장 안 식당이 섞였다. "전통시장"이 더 정확했다.
            _sub("market", "시장", _MARKET),
            _sub("prop_shop", "소품숍", _PROP_SHOP),
            _sub("select_shop", "편집숍", KakaoSearch(keyword="편집샵", require=("가정,생활",))),
        ),
    ),
)

_BY_CODE = {category.code: category for category in CATEGORIES}


def find_subcategory(category_code: str, subcategory_code: str) -> Subcategory | None:
    """대분류와 소분류 조합에 맞는 소분류를 찾는다.

    :param category_code: 대분류 코드
    :param subcategory_code: 소분류 코드
    :return: 맞는 소분류. 조합이 틀리면 None

    다른 대분류의 소분류를 넣으면 None이다. 화면이 대분류를 바꾸고 소분류를 초기화하지
    않은 채 보내는 경우를 여기서 막는다(기획서 4.2절).
    """
    category = _BY_CODE.get(category_code)
    if category is None:
        return None
    return next((sub for sub in category.subcategories if sub.code == subcategory_code), None)


def _segments(path: str) -> list[str]:
    return [part.strip() for part in path.split(">") if part.strip()]


def _starts_with(path: list[str], prefix: str) -> bool:
    """업종 경로가 prefix로 시작하는지 **칸 단위로** 본다.

    글자로 비교하면 "여행 > 공원"이 "여행 > 공원시설물"에도 걸린다. 칸으로 나눠 앞에서부터
    같은지를 봐야 공원 안의 주차장·화장실이 공원으로 잡히지 않는다.
    """
    wanted = _segments(prefix)
    return path[: len(wanted)] == wanted


def matches(search: KakaoSearch, category_path: str | None) -> bool:
    """카카오 결과 하나가 이 검색의 거름망을 통과하는지.

    :param search: 검색 조건
    :param category_path: 결과의 `category_name`. 없을 수 있다
    """
    path = _segments(category_path or "")
    if search.require and not any(_starts_with(path, prefix) for prefix in search.require):
        return False
    return not any(_starts_with(path, prefix) for prefix in search.exclude)
