"""약관·개인정보 처리방침 문서 제공.

**문서를 클라이언트에 넣지 않고 서버가 내려주는 이유**는 두 가지다.

1. 진실의 출처를 하나로 둔다. 웹과 앱에 각각 넣으면 한쪽만 고쳐져 서로 다른 약관을
   보여주는 상태가 생긴다. 약관은 그게 그대로 분쟁거리가 된다.
2. 앱 스토어 심사를 다시 받지 않고 문구를 고칠 수 있다. 법률 검토 결과가 반영되는
   시점은 보통 배포 주기와 맞지 않는다.

원문은 `app/legal/documents/*.md`에 있다. 검토자가 마크다운을 그대로 고치면 되고,
여기서는 화면이 그리기 쉬운 블록 목록으로 바꿔 내려준다. 클라이언트마다 마크다운
파서를 하나씩 들이지 않기 위해서다.
"""

import re
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

from app.legal.errors import LegalDocumentNotFoundError
from app.legal.schemas import LegalBlock, LegalDocumentResponse

DOCUMENTS_DIR = Path(__file__).parent / "documents"

# 공개하는 문서 코드와 파일 이름. 여기 없는 코드는 404다. 경로를 그대로 파일명으로
# 쓰면 ../로 서버의 아무 파일이나 읽어갈 수 있으므로 목록으로 고정한다.
DOCUMENTS = {
    "privacy-policy": "privacy-policy.md",
    "terms-of-service": "terms-of-service.md",
}

# 원문 맨 앞의 검토 안내(> 인용 블록)는 운영자끼리 보는 메모라 화면에 내보내지 않는다.
_DRAFT_NOTICE_PREFIX = "초안입니다"


def _inline(text: str) -> str:
    """문단 안의 마크다운 표시를 걷어낸다.

    :param text: 원문 한 줄
    :return: 화면에 그대로 쓸 수 있는 문장

    강조(`**`)와 코드(`` ` ``)는 뜻을 잃지 않으므로 기호만 없앤다. 그대로 두면 화면에
    별표와 백틱이 글자로 보인다. 링크는 주소를 버리고 글자만 남긴다 — 약관 화면에는
    바깥으로 나가는 링크를 두지 않는다.
    """
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("**", "")
    return text.replace("`", "")


def _table_rows(lines: list[str]) -> list[list[str]]:
    """마크다운 표를 행 목록으로 바꾼다. 구분선(`|---|`)은 버린다."""
    rows = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        # 구분선은 모든 칸이 -와 :로만 되어 있다.
        if all(re.fullmatch(r":?-{2,}:?", cell) for cell in cells):
            continue
        rows.append([_inline(cell) for cell in cells])
    return rows


def _parse(text: str) -> tuple[str, list[LegalBlock]]:
    """마크다운을 (제목, 블록 목록)으로 바꾼다.

    :param text: 문서 원문
    :return: 첫 `#` 제목과 화면이 그릴 블록들

    지원하는 문법은 이 문서들이 실제로 쓰는 것만이다 — 제목(`#`~`###`), 문단,
    번호·불릿 목록, 표, 인용. 범용 파서를 만들지 않는 이유는, 쓰지 않는 문법까지
    지원하면 검증할 수 없는 경로가 늘어나기 때문이다. 새 문법이 필요하면 여기에
    한 가지씩 추가한다.
    """
    title = ""
    blocks: list[LegalBlock] = []
    buffer: list[str] = []
    table: list[str] = []
    quote: list[str] = []

    def flush_paragraph() -> None:
        if buffer:
            blocks.append(LegalBlock(type="paragraph", text=_inline(" ".join(buffer))))
            buffer.clear()

    def flush_table() -> None:
        if table:
            blocks.append(LegalBlock(type="table", rows=_table_rows(table)))
            table.clear()

    def flush_quote() -> None:
        if quote:
            joined = _inline(" ".join(quote))
            # 문서 맨 앞의 초안 안내만 걸러낸다. 본문 안의 인용은 사용자가 꼭 읽어야
            # 하는 주의사항(탈퇴 후 남는 기록 등)이라 그대로 내보낸다.
            if not joined.lstrip("* ").startswith(_DRAFT_NOTICE_PREFIX):
                blocks.append(LegalBlock(type="callout", text=joined))
            quote.clear()

    def flush_all() -> None:
        flush_paragraph()
        flush_table()
        flush_quote()

    for raw in text.splitlines():
        line = raw.rstrip()
        stripped = line.strip()

        if stripped.startswith("|"):
            flush_paragraph()
            flush_quote()
            table.append(stripped)
            continue
        flush_table()

        if stripped.startswith(">"):
            flush_paragraph()
            quote.append(stripped.lstrip("> ").strip())
            continue
        flush_quote()

        if not stripped or stripped == "---":
            flush_paragraph()
            continue

        if stripped.startswith("#"):
            flush_all()
            level = len(stripped) - len(stripped.lstrip("#"))
            heading = stripped.lstrip("#").strip()
            if level == 1 and not title:
                title = heading
            else:
                blocks.append(LegalBlock(type="heading", text=_inline(heading), level=level))
            continue

        bullet = re.match(r"^(?:[-*]|\d+\.)\s+(.*)$", stripped)
        if bullet:
            flush_paragraph()
            # 목록은 항목마다 한 블록으로 내보낸다. 화면이 줄바꿈과 들여쓰기를 직접
            # 정하게 하려는 것이다. 묶어서 보내면 플랫폼마다 다시 쪼개야 한다.
            blocks.append(LegalBlock(type="bullet", text=_inline(bullet.group(1).strip())))
            continue

        buffer.append(stripped)

    flush_all()
    return title, blocks


def _updated_at(path: Path) -> date:
    """문서 파일의 마지막 수정일. 화면에 "최종 개정일"로 보여준다.

    문서 안에 날짜를 적어두고 고칠 때 같이 안 고치면 사실과 달라진다. 파일 시각을
    쓰면 그 어긋남이 생기지 않는다. 다만 배포 방식에 따라 시각이 배포 시점으로
    바뀔 수 있으므로, 정식 공고일은 문서 본문의 부칙을 따른다.
    """
    return datetime.fromtimestamp(path.stat().st_mtime).date()


@lru_cache(maxsize=len(DOCUMENTS))
def get_document(code: str) -> LegalDocumentResponse:
    """문서 하나를 화면이 그릴 형태로 돌려준다.

    :param code: DOCUMENTS의 키
    :raises LegalDocumentNotFoundError: 공개 목록에 없는 코드일 때 (404)

    파일은 배포 중에 바뀌지 않으므로 한 번 읽어 캐시한다. 문서를 고쳤다면 서버를
    다시 띄워야 반영된다.
    """
    filename = DOCUMENTS.get(code)
    if filename is None:
        raise LegalDocumentNotFoundError()

    path = DOCUMENTS_DIR / filename
    title, blocks = _parse(path.read_text(encoding="utf-8"))
    return LegalDocumentResponse(
        code=code, title=title, updated_at=_updated_at(path), blocks=blocks
    )
