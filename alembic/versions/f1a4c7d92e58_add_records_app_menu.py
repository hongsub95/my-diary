"""add records app menu

Revision ID: f1a4c7d92e58
Revises: d7f9c2a1e4b6
Create Date: 2026-08-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f1a4c7d92e58"
down_revision: Union[str, Sequence[str], None] = "d7f9c2a1e4b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 최종 하단 탭은 홈 · 캘린더 · 일정 · 기록 · 더보기 5개다
# (docs/BOTTOM_NAVIGATION_SPEC.md 3절). 기록이 네 번째이므로 더보기를 뒤로 민다.
RECORDS_SORT_ORDER = 4


def _menu_table() -> sa.Table:
    """이 마이그레이션에서 다루는 컬럼만 담은 nl_menus 테이블 표현."""
    return sa.table(
        "nl_menus",
        sa.column("code", sa.String),
        sa.column("scope", sa.String),
        sa.column("name", sa.String),
        sa.column("icon", sa.String),
        sa.column("path", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("is_active", sa.Boolean),
    )


def upgrade() -> None:
    """기록 메뉴를 일정과 더보기 사이에 넣는다."""
    menu = _menu_table()

    # 기록이 들어갈 자리부터 뒤를 한 칸씩 민다. 지금은 더보기 하나뿐이지만,
    # 자리 번호를 직접 다시 매기지 않고 밀어내면 뒤에 메뉴가 늘어도 그대로 동작한다.
    op.execute(
        menu.update()
        .where(sa.and_(menu.c.scope == "app", menu.c.sort_order >= RECORDS_SORT_ORDER))
        .values(sort_order=menu.c.sort_order + 1)
    )

    # is_active=False로 넣는다. 아직 기록 화면도 일기·사진 API도 없어서, 켜두면
    # "눌러도 아무것도 없는 탭"이 된다. 미구현 탭은 서버 메뉴에서 비활성화한다는
    # 규칙(BOTTOM_NAVIGATION_SPEC.md 7절)과 "기록 화면·API 구현과 같은 변경 단위로
    # 노출한다"는 API_SPEC.md 3-M절을 따른 것이다.
    #
    # 그래도 지금 행을 만들어 두는 이유: 자리(sort_order)를 지금 확정해두면, 나중에
    # 기록을 켤 때 순서를 다시 흔들 필요 없이 is_active만 바꾸면 된다.
    op.bulk_insert(
        menu,
        [
            {
                "code": "records",
                "scope": "app",
                "name": "기록",
                "icon": "book",
                "path": "/records",
                "sort_order": RECORDS_SORT_ORDER,
                "is_active": False,
            }
        ],
    )


def downgrade() -> None:
    """기록 메뉴를 지우고 뒤 메뉴의 자리를 되돌린다."""
    menu = _menu_table()

    op.execute(menu.delete().where(menu.c.code == "records"))
    op.execute(
        menu.update()
        .where(sa.and_(menu.c.scope == "app", menu.c.sort_order > RECORDS_SORT_ORDER))
        .values(sort_order=menu.c.sort_order - 1)
    )
