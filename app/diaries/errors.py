"""일기 API의 오류 정의.

일정에 딸린 리소스이므로 접근 판정은 일정과 같다. 일정을 볼 수 없으면 그 일기도 볼 수
없고, 응답은 일정 쪽에서 이미 404로 끝난다. 여기서는 일정까지는 통과했지만 일기 단계에서
어긋난 경우만 다룬다.
"""

from fastapi import status

from app.core.errors import AppError


class DiaryEntryNotFoundError(AppError):
    """이 일정에 내가 쓴 본문이 아직 없는 경우.

    남의 본문을 지목할 방법이 없어서 "남의 것을 찾지 못했다"는 상황은 생기지 않는다.
    경로에 작성자 id가 없고 인증 정보로만 본인 항목을 찾기 때문이다
    (docs/API_SPEC.md 7장).
    """

    def __init__(self) -> None:
        super().__init__(
            code="DIARY_ENTRY_NOT_FOUND",
            message="아직 작성한 일기가 없습니다.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
