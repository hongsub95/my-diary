"""add schedule completed_at

Revision ID: fb61fefe3cae
Revises: f1a4c7d92e58
Create Date: 2026-09-02 00:10:22.093800

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb61fefe3cae'
down_revision: Union[str, Sequence[str], None] = 'f1a4c7d92e58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """일정에 완료 시각 컬럼을 추가한다.

    기존 완료 일정은 값을 채우지 않고 NULL로 둔다. 실제로 언제 완료 처리했는지 알 수
    없어서 end_at으로 메우면 없던 사실을 만들어내게 된다. 기록 목록은 completed_at이
    없으면 end_at으로 정렬하도록 되어 있어(docs/API_SPEC.md 7장) NULL이어도 문제없다.
    """
    op.add_column('nl_schedules', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """완료 시각 컬럼을 제거한다. 기록된 완료 시각은 함께 사라진다."""
    op.drop_column('nl_schedules', 'completed_at')
