"""사용자가 고른 테마 색상 키(theme_key) 추가

Revision ID: 25837e2da5d5
Revises: c8687d385185
Create Date: 2026-09-12 00:25:32.884266

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '25837e2da5d5'
down_revision: Union[str, Sequence[str], None] = 'c8687d385185'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """nl_users에 theme_key를 추가한다.

    server_default='rose'를 두면 이미 가입해 있는 회원도 마이그레이션 시점에 기본
    테마로 메워진다. 이게 없으면 NOT NULL 컬럼을 기존 행에 추가할 수 없다.

    CHECK 제약은 걸지 않는다. 프리셋이 늘 때마다 마이그레이션을 새로 만들어야 하고,
    허용 값 검사는 요청 스키마(app/users/schemas.py)가 이미 한다.
    """
    op.add_column(
        'nl_users',
        sa.Column('theme_key', sa.String(length=20), server_default='rose', nullable=False),
    )


def downgrade() -> None:
    """theme_key를 없앤다. 사용자가 고른 테마 선택이 함께 사라진다."""
    op.drop_column('nl_users', 'theme_key')
