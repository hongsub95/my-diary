"""activate records app menu

Revision ID: c3e81d47a9f2
Revises: 05bedffbec2c
Create Date: 2026-09-09
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c3e81d47a9f2"
down_revision: Union[str, Sequence[str], None] = "05bedffbec2c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _menu_table() -> sa.Table:
    """이 마이그레이션에서 다루는 컬럼만 담은 nl_menus 테이블 표현."""
    return sa.table(
        "nl_menus",
        sa.column("code", sa.String),
        sa.column("is_active", sa.Boolean),
    )


def upgrade() -> None:
    """기록 탭을 노출한다.

    f1a4c7d92e58에서 이 메뉴를 비활성으로 넣었다. 그때는 기록 화면이 없어서, 탭이 뜨면
    눌러도 갈 곳이 없었기 때문이다. 이제 일기·사진·타임라인 API와 웹·모바일의 기록 목록
    화면이 모두 준비돼 켤 수 있다.

    "기록 화면과 API가 구현되기 전에는 records를 노출하지 않으며, 구현과 같은 변경
    단위로 DB seed에 추가한다"는 규칙(docs/API_SPEC.md 3-M절)의 마지막 절차다.
    """
    menu = _menu_table()
    op.execute(menu.update().where(menu.c.code == "records").values(is_active=True))


def downgrade() -> None:
    """기록 탭을 다시 감춘다. 메뉴 행과 순서는 그대로 두고 노출만 되돌린다."""
    menu = _menu_table()
    op.execute(menu.update().where(menu.c.code == "records").values(is_active=False))
