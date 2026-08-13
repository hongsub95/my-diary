"""장소 API의 오류 정의.

일정에 딸린 리소스이므로 접근 판정은 일정과 같다. 일정을 볼 수 없으면 그 일정의
장소도 볼 수 없고, 응답은 일정 쪽에서 이미 404로 끝난다. 여기서는 일정까지는
통과했지만 장소 단계에서 어긋난 경우만 다룬다.
"""

from fastapi import status

from app.core.errors import AppError


class SchedulePlaceNotFoundError(AppError):
    """그 일정에 속하지 않는 장소를 가리킨 경우.

    다른 일정의 schedule_place_id를 넣어도 같은 404다. 일정 단위로 범위를 좁혀
    검사하므로 남의 일정에 달린 장소를 건드릴 수 없다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="SCHEDULE_PLACE_NOT_FOUND",
            message="일정에서 해당 장소를 찾을 수 없습니다.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class InvalidReorderError(AppError):
    """순서 변경 요청의 id 목록이 그 일정의 장소 전체와 일치하지 않는 경우.

    부분 목록을 허용하면 빠진 장소의 순서를 어떻게 둘지 정해야 하고, 두 사람이 동시에
    순서를 바꿀 때 결과가 예측 불가능해진다. 전체를 한 번에 받는 이유다.
    """

    def __init__(self, message: str) -> None:
        super().__init__(
            code="INVALID_REORDER",
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            field="schedule_place_ids",
        )


class PlaceSearchUnavailableError(AppError):
    """지도 공급자를 호출할 수 없는 경우.

    공급자의 원본 오류를 그대로 내보내지 않는다. 키·쿼터 같은 내부 사정이 노출되고,
    공급자를 바꾸면 클라이언트가 함께 깨지기 때문이다 (docs/API_SPEC.md 공급자 어댑터 요구사항).
    """

    def __init__(self) -> None:
        super().__init__(
            code="PLACE_SEARCH_UNAVAILABLE",
            message="장소 검색을 잠시 사용할 수 없습니다. 직접 입력해 주세요.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
