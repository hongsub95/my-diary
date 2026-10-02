"""코스 추천 API의 오류 정의.

일정까지의 접근 판정은 일정 쪽(ScheduleMemberContext)에서 끝난다. 여기서는 일정은 볼 수
있지만 추천 조건이 어긋난 경우만 다룬다. 코드 이름은 docs/API_SPEC.md 추천 절의 표를 따른다.
"""

from fastapi import status

from app.core.errors import AppError


class InvalidCategoryCombinationError(AppError):
    """대분류와 소분류 조합이 맞지 않는 경우.

    화면이 대분류를 바꾸고 소분류를 초기화하지 않은 채 보내면 여기에 걸린다(기획서 4.2절).
    몇 번째 항목인지 field에 담아, 화면이 그 칸을 짚어 줄 수 있게 한다.

    :param item_index: 어긋난 코스 항목의 자리 (0부터)
    """

    def __init__(self, item_index: int) -> None:
        super().__init__(
            code="INVALID_CATEGORY_COMBINATION",
            message="고른 분류를 다시 확인해 주세요.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            field=f"items.{item_index}",
        )


class InvalidAnchorPlaceError(AppError):
    """기준 장소가 이 일정에 없거나, 좌표가 없어 주변을 찾을 수 없는 경우.

    다른 일정의 장소 id를 넣어도 같은 오류다. 일정 안에서만 찾으므로 남의 장소가 있는지
    없는지 알려주지 않는다.
    """

    def __init__(self, message: str = "기준 장소를 찾을 수 없습니다.") -> None:
        super().__init__(
            code="INVALID_ANCHOR_PLACE",
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            field="anchor.schedule_place_id",
        )


class AreaNotFoundError(AppError):
    """지역 이름으로 위치를 찾지 못한 경우. 다른 이름으로 다시 입력하게 한다."""

    def __init__(self) -> None:
        super().__init__(
            code="AREA_NOT_FOUND",
            message="지역을 찾지 못했어요. 동네나 역 이름으로 다시 입력해 주세요.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            field="area_query",
        )
