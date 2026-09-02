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


class DiaryPhotoNotFoundError(AppError):
    """없는 사진이거나 볼 수 없는 일정의 사진을 가리킨 경우.

    권한이 없을 때도 같은 404를 준다. 403을 주면 "그 번호의 사진은 존재한다"가 노출된다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="DIARY_PHOTO_NOT_FOUND",
            message="사진을 찾을 수 없습니다.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class PhotoDeleteForbiddenError(AppError):
    """남이 올린 사진을 일반 멤버가 지우려 한 경우.

    여기서는 404가 아니라 403을 쓴다. 그 사진이 있다는 사실은 이미 목록으로 봤기
    때문에 숨길 것이 없고, "왜 안 지워지는지"를 알려주는 편이 낫다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="PHOTO_DELETE_FORBIDDEN",
            message="다른 사람이 올린 사진은 삭제할 수 없습니다.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class FileTooLargeError(AppError):
    """장당 크기 제한을 넘은 경우."""

    def __init__(self, max_bytes: int) -> None:
        super().__init__(
            code="FILE_TOO_LARGE",
            message=f"사진 한 장의 크기는 {max_bytes // (1024 * 1024)}MB를 넘을 수 없습니다.",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            field="files",
        )


class UnsupportedFileTypeError(AppError):
    """허용하지 않는 형식이거나, 확장자와 실제 내용이 다른 경우."""

    def __init__(self) -> None:
        super().__init__(
            code="UNSUPPORTED_FILE_TYPE",
            message="jpg, png, webp, heic 형식의 이미지만 올릴 수 있습니다.",
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            field="files",
        )


class PhotoLimitExceededError(AppError):
    """1회 장수 또는 하루 총 장수 제한을 넘은 경우."""

    def __init__(self, message: str) -> None:
        super().__init__(
            code="PHOTO_LIMIT_EXCEEDED",
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            field="files",
        )


class InvalidPhotoReorderError(AppError):
    """순서 변경 요청의 id 목록이 그 일정의 사진 전체와 일치하지 않는 경우.

    장소 순서 변경(app/places/errors.py)과 같은 규칙이다. 부분 목록을 허용하면 빠진
    사진의 순서를 어떻게 둘지 정해야 하고, 두 사람이 동시에 바꿀 때 결과를 예측할 수 없다.
    """

    def __init__(self, message: str) -> None:
        super().__init__(
            code="INVALID_PHOTO_REORDER",
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            field="photo_ids",
        )


class DiaryTimelineItemNotFoundError(AppError):
    """없는 타임라인 항목이거나 볼 수 없는 일정의 항목을 가리킨 경우."""

    def __init__(self) -> None:
        super().__init__(
            code="DIARY_TIMELINE_ITEM_NOT_FOUND",
            message="타임라인 항목을 찾을 수 없습니다.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class TimelineEditForbiddenError(AppError):
    """남이 남긴 타임라인 항목을 일반 멤버가 고치거나 지우려 한 경우.

    사진 삭제와 같은 이유로 404가 아니라 403이다. 목록에서 이미 본 항목이라 숨길 것이 없다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="TIMELINE_EDIT_FORBIDDEN",
            message="다른 사람이 남긴 기록은 수정하거나 삭제할 수 없습니다.",
            status_code=status.HTTP_403_FORBIDDEN,
        )


class InvalidTimelinePlaceError(AppError):
    """이 일정에 담기지 않은 장소를 타임라인에 연결하려 한 경우.

    다른 일정의 schedule_place_id를 넣어도 같은 오류다. 허용하면 남의 일정에 담긴
    장소의 존재 여부를 알아낼 수 있다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="INVALID_TIMELINE_PLACE",
            message="이 일정에 담긴 장소만 연결할 수 있습니다.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            field="schedule_place_id",
        )
