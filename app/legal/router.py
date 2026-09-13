"""약관·개인정보 처리방침 엔드포인트.

**인증을 요구하지 않는다.** 가입하기 전에 약관을 읽어야 동의할 수 있고, 처리방침은
누구나 볼 수 있어야 한다.
"""

from fastapi import APIRouter

from app.legal import service
from app.legal.schemas import (
    LegalDocumentListResponse,
    LegalDocumentResponse,
    LegalDocumentSummary,
)

router = APIRouter(prefix="/legal", tags=["legal"])


@router.get(
    "/documents",
    response_model=LegalDocumentListResponse,
    summary="약관 문서 목록",
    description="공개 중인 문서의 코드와 제목. 본문은 담기지 않는다.",
)
def list_documents() -> LegalDocumentListResponse:
    """약관 문서 목록."""
    return LegalDocumentListResponse(
        documents=[
            LegalDocumentSummary(
                code=document.code, title=document.title, updated_at=document.updated_at
            )
            for document in (service.get_document(code) for code in service.DOCUMENTS)
        ]
    )


@router.get(
    "/documents/{code}",
    response_model=LegalDocumentResponse,
    summary="약관 문서 조회",
    description=(
        "문서 본문을 화면이 그릴 수 있는 블록 목록으로 돌려준다. "
        "마크다운을 그대로 주지 않는 이유는 웹과 앱이 각각 파서를 들이지 않게 하기 위해서다."
    ),
)
def get_document(code: str) -> LegalDocumentResponse:
    """약관 문서 조회."""
    return service.get_document(code)
