"""스페이스 관련 오류 정의.

모든 오류는 {code, message, field} 형태로 응답된다 (app/core/errors.py 참고).

권한 실패는 상황에 따라 403과 404를 구분해 쓴다.

- 비멤버 → **404**. 403을 주면 "그 스페이스는 존재한다"는 사실이 노출된다.
- 멤버지만 권한 부족(예: 일반 멤버가 설정 변경) → **403**. 이미 존재를 아는 상태라
  숨길 것이 없고, 클라이언트도 "권한 없음"을 안내해야 한다.
"""

from fastapi import status

from app.core.errors import AppError


class SpaceNotFoundError(AppError):
    """스페이스가 없거나, 있어도 요청자가 멤버가 아닌 경우.

    두 경우를 구분하지 않는 이유: 구분하면 UUID를 바꿔가며 찔러보는 것만으로
    "이 스페이스는 실재한다"를 알아낼 수 있다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="SPACE_NOT_FOUND",
            message="공간을 찾을 수 없습니다.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class SpaceForbiddenError(AppError):
    """멤버이지만 이 작업을 할 권한이 없는 경우 (예: 일반 멤버의 스페이스 설정 변경)."""

    def __init__(self, message: str = "이 작업을 수행할 권한이 없습니다.") -> None:
        super().__init__(
            code="SPACE_FORBIDDEN",
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
        )


class InvalidJoinCodeError(AppError):
    """참여 번호가 존재하지 않는 경우.

    "형식 오류"와 "없는 번호"를 구분하지 않는다. 구분하면 번호를 대입해가며
    유효한 형식을 좁혀갈 수 있다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="INVALID_JOIN_CODE",
            message="참여 번호를 확인해 주세요.",
            status_code=status.HTTP_404_NOT_FOUND,
            field="join_code",
        )


class AlreadyMemberError(AppError):
    """이미 그 스페이스의 활성 멤버인 경우.

    클라이언트는 오류로 표시하는 대신 해당 스페이스로 이동시켜도 된다 (명세 7.3).
    """

    def __init__(self) -> None:
        super().__init__(
            code="ALREADY_MEMBER",
            message="이미 참여 중인 공간입니다.",
            status_code=status.HTTP_409_CONFLICT,
            field="join_code",
        )


class SpaceArchivedError(AppError):
    """보관된 스페이스에 참여하려는 경우."""

    def __init__(self) -> None:
        super().__init__(
            code="SPACE_ARCHIVED",
            message="보관된 공간입니다.",
            status_code=status.HTTP_410_GONE,
            field="join_code",
        )


class SpaceMemberLimitError(AppError):
    """공유 스페이스 정원을 초과한 경우."""

    def __init__(self, limit: int) -> None:
        super().__init__(
            code="SPACE_MEMBER_LIMIT",
            message=f"공간 정원({limit}명)이 가득 찼습니다.",
            status_code=status.HTTP_409_CONFLICT,
            field="join_code",
        )


class PersonalSpaceError(AppError):
    """개인 스페이스에 허용되지 않는 작업을 시도한 경우.

    개인 스페이스는 초대·나가기·삭제가 모두 불가능하다 (명세 4.2).
    """

    def __init__(self, message: str = "개인 공간에는 할 수 없는 작업입니다.") -> None:
        super().__init__(
            code="PERSONAL_SPACE_NOT_ALLOWED",
            message=message,
            status_code=status.HTTP_409_CONFLICT,
        )


class DefaultSpaceCannotBeDeletedError(AppError):
    """기본 스페이스로 지정된 스페이스를 삭제하려는 경우.

    삭제하려면 먼저 기본 스페이스를 다른 곳으로 바꿔야 한다 (명세 0절).
    """

    def __init__(self) -> None:
        super().__init__(
            code="DEFAULT_SPACE_CANNOT_BE_DELETED",
            message="처음 열 공간은 삭제할 수 없습니다. 먼저 다른 공간을 처음 열 공간으로 지정해 주세요.",
            status_code=status.HTTP_409_CONFLICT,
        )


class OwnerMustTransferError(AppError):
    """다른 멤버가 남아 있는데 owner가 나가려는 경우.

    혼자면 스페이스를 삭제하고 나갈 수 있지만, 남은 멤버가 있으면 소유권을 먼저
    넘겨야 한다 (명세 0절 확정 결정).
    """

    def __init__(self) -> None:
        super().__init__(
            code="OWNER_MUST_TRANSFER",
            message="다른 멤버에게 주인을 넘긴 뒤 나갈 수 있습니다.",
            status_code=status.HTTP_409_CONFLICT,
        )


class MemberNotFoundError(AppError):
    """대상 사용자가 그 스페이스의 활성 멤버가 아닌 경우."""

    def __init__(self) -> None:
        super().__init__(
            code="MEMBER_NOT_FOUND",
            message="해당 멤버를 찾을 수 없습니다.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
