"""약관 문서 조회 오류."""

from fastapi import status

from app.core.errors import AppError


class LegalDocumentNotFoundError(AppError):
    """공개 목록에 없는 문서 코드를 요청한 경우.

    어떤 코드가 있는지는 GET /legal/documents로 알 수 있으므로 숨기지 않는다.
    """

    def __init__(self) -> None:
        super().__init__(
            code="LEGAL_DOCUMENT_NOT_FOUND",
            message="요청한 문서를 찾을 수 없습니다.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
