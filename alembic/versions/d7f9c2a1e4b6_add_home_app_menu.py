"""add home app menu

Revision ID: d7f9c2a1e4b6
Revises: b3c32666bfc6
Create Date: 2026-08-20
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d7f9c2a1e4b6"
down_revision: Union[str, Sequence[str], None] = "b3c32666bfc6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    menu = sa.table(
        "nl_menus",
        sa.column("code", sa.String),
        sa.column("scope", sa.String),
        sa.column("name", sa.String),
        sa.column("icon", sa.String),
        sa.column("path", sa.String),
        sa.column("sort_order", sa.Integer),
        sa.column("is_active", sa.Boolean),
    )
    op.execute(menu.update().where(menu.c.scope == "app").values(sort_order=menu.c.sort_order + 1))
    op.execute(
        menu.update()
        .where(menu.c.code == "settings")
        .values(code="more", name="더보기", icon="more-horizontal", path="/more")
    )
    op.bulk_insert(
        menu,
        [{
            "code": "home",
            "scope": "app",
            "name": "홈",
            "icon": "home",
            "path": "/home",
            "sort_order": 1,
            "is_active": True,
        }],
    )


def downgrade() -> None:
    menu = sa.table(
        "nl_menus",
        sa.column("code", sa.String),
        sa.column("scope", sa.String),
        sa.column("name", sa.String),
        sa.column("icon", sa.String),
        sa.column("path", sa.String),
        sa.column("sort_order", sa.Integer),
    )
    op.execute(menu.delete().where(menu.c.code == "home"))
    op.execute(
        menu.update()
        .where(menu.c.code == "more")
        .values(code="settings", name="설정", icon="settings", path="/settings")
    )
    op.execute(menu.update().where(menu.c.scope == "app").values(sort_order=menu.c.sort_order - 1))
