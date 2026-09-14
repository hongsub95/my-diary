"""계정 상태(status)와 로그인 잠금 컬럼 추가

Revision ID: d428a8fc5b37
Revises: 0cb4af0b0fe8
Create Date: 2026-09-14 23:25:15.159944

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd428a8fc5b37'
down_revision: Union[str, Sequence[str], None] = '0cb4af0b0fe8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """nl_users에 status, login_failed_count, locked_until을 추가한다.

    status는 운영 상태(1 활성 / 2 임시 / 10 휴면 / 11 잠김)이고, 탈퇴 여부인 use와는
    역할이 다르다. 자세한 구분은 app/users/models.py의 표에 있다.

    server_default를 두어 이미 가입해 있는 회원이 전부 '활성, 실패 0회'로 메워진다.
    이게 없으면 NOT NULL 컬럼을 기존 행에 추가할 수 없다.
    """
    op.add_column('nl_users', sa.Column('status', sa.Integer(), server_default='1', nullable=False))
    op.add_column('nl_users', sa.Column('login_failed_count', sa.Integer(), server_default='0', nullable=False))
    op.add_column('nl_users', sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """세 컬럼을 없앤다. 되돌리면 잠긴 계정이 그대로 풀린다."""
    op.drop_column('nl_users', 'locked_until')
    op.drop_column('nl_users', 'login_failed_count')
    op.drop_column('nl_users', 'status')
