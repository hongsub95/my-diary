"""사용자 계절 배경 설정(켜기/끄기, 낮·밤) 추가

Revision ID: b3c9e1f7a2d4
Revises: 416a3a1ce460
Create Date: 2026-11-13 23:55:00.000000

계절 배경(지금은 크리스마스)은 더보기 › 나에게 맞추기에서 켜고 끄며, 그 아래
"사용자 설정"에서 자동·낮·밤을 고른다. 테마 색처럼 계정에 저장해 웹과 앱이 같게 보이게 한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c9e1f7a2d4'
down_revision: Union[str, Sequence[str], None] = '416a3a1ce460'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """nl_users에 seasonal_background_enabled, seasonal_background_time을 추가한다.

    server_default를 두는 이유는 theme_key와 같다. 이미 가입한 회원도 마이그레이션
    시점에 기본값(켜짐, auto)으로 메워지고, NOT NULL 컬럼을 기존 행에 추가할 수 있다.
    CHECK 제약은 걸지 않는다. 허용 값 검사는 요청 스키마(app/users/schemas.py)가 한다.
    """
    op.add_column(
        'nl_users',
        sa.Column('seasonal_background_enabled', sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        'nl_users',
        sa.Column('seasonal_background_time', sa.String(length=10), server_default='auto', nullable=False),
    )


def downgrade() -> None:
    """두 컬럼을 없앤다. 사용자가 꺼 둔 선택과 낮·밤 선택이 함께 사라진다."""
    op.drop_column('nl_users', 'seasonal_background_time')
    op.drop_column('nl_users', 'seasonal_background_enabled')
