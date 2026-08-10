"""일정 API의 오류 정의.

권한 실패의 상태 코드 원칙은 스페이스와 같다 (app/spaces/errors.py).

- 접근할 수 없는 일정 → **404**. 403을 주면 "그 일정은 존재한다"가 노출된다.
- 볼 수는 있지만 지울 권한이 없는 경우 → **403**. 이미 존재를 아는 상태다.
"""

from fastapi import status

from app.core.errors import AppError

# 생성(pydantic)과 수정(서비스)에서 같은 문구를 써야 클라이언트가 한 가지만 처리한다.
TIME_RANGE_MESSAGE = "종료 시각은 시작 시각보다 앞설 수 없습니다."


class ScheduleNotFoundError(AppError):
    """일정이 없거나, 있어도 요청자가 그 스페이스의 멤버가 아닌 경우.

    두 경우를 구분하지 않는 이유: 구분하면 id를 1씩 올려가며 찔러보는 것만으로
    "이 번호의 일정은 실재한다"를 알아낼 수 있다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="SCHEDULE_NOT_FOUND",
            message="일정을 찾을 수 없습니다.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ScheduleForbiddenError(AppError):
    """일정을 볼 수는 있지만 이 작업을 할 권한이 없는 경우.

    지금은 삭제에만 쓴다. 공유 스페이스의 일반 멤버는 본인이 만든 일정만 지울 수 있다
    (docs/API_SPEC.md 4.6절).
    """

    def __init__(self, message: str = "이 작업을 수행할 권한이 없습니다.") -> None:
        super().__init__(
            code="SCHEDULE_FORBIDDEN",
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
        )


class InvalidTimeRangeError(AppError):
    """수정 결과 종료 시각이 시작 시각보다 앞서게 되는 경우.

    생성 요청은 두 값이 항상 함께 오므로 pydantic이 먼저 걸러 `VALIDATION_ERROR`를 낸다.
    수정은 한쪽만 보낼 수 있어 DB의 기존 값과 합쳐봐야 알 수 있는데, 그때도 클라이언트가
    같은 코드로 처리할 수 있도록 code와 문구를 생성 쪽과 일치시킨다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="VALIDATION_ERROR",
            message=TIME_RANGE_MESSAGE,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            field="end_at",
        )


class InvalidDateRangeError(AppError):
    """조회 기간의 from이 to보다 뒤인 경우.

    빈 목록을 돌려주지 않고 오류로 알리는 이유: 클라이언트가 두 값을 바꿔 넣은
    실수일 가능성이 높은데, 빈 배열을 주면 "일정이 없다"로 오해하게 된다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="INVALID_DATE_RANGE",
            message="조회 시작일이 종료일보다 뒤일 수 없습니다.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            field="from",
        )
