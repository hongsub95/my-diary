"""약관 문서 응답 형태."""

from datetime import date
from typing import Literal

from pydantic import BaseModel

# 화면이 그릴 수 있는 블록 종류. 마크다운을 그대로 내려주지 않는 이유는 웹과 앱이
# 각각 파서를 들이지 않게 하기 위해서다 (app/legal/service.py 참고).
BlockType = Literal["heading", "paragraph", "bullet", "table", "callout"]


class LegalBlock(BaseModel):
    """문서의 한 덩어리.

    type에 따라 채워지는 필드가 다르다.
    - heading: text, level (2~3)
    - paragraph / bullet / callout: text
    - table: rows (첫 줄이 머리글)
    """

    type: BlockType
    text: str | None = None
    # 제목 단계. 2가 절, 3이 소절이다.
    level: int | None = None
    # 표의 행 목록. 첫 행이 머리글이다.
    rows: list[list[str]] | None = None


class LegalDocumentResponse(BaseModel):
    """문서 하나."""

    code: str
    title: str
    # 문서 파일의 마지막 수정일. 정식 공고일은 본문 부칙을 따른다.
    updated_at: date
    blocks: list[LegalBlock]


class LegalDocumentSummary(BaseModel):
    """목록에 쓰는 요약. 본문 없이 제목만 필요한 화면을 위한 것이다."""

    code: str
    title: str
    updated_at: date


class LegalDocumentListResponse(BaseModel):
    documents: list[LegalDocumentSummary]
