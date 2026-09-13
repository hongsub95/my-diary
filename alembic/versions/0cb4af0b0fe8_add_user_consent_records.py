"""가입 시 받은 동의 기록(nl_user_consents) 추가

Revision ID: 0cb4af0b0fe8
Revises: a62e901bf453
Create Date: 2026-09-13 22:52:48.053713

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0cb4af0b0fe8'
down_revision: Union[str, Sequence[str], None] = 'a62e901bf453'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """동의 기록 테이블을 만든다.

    「개인정보 보호법」은 동의를 받았다는 사실을 입증할 수 있어야 한다고 요구한다.
    가입 화면의 체크박스 값을 버리면 나중에 내놓을 것이 없다.

    document_revision은 동의한 문서의 개정일이다. 약관이 바뀌었을 때 재동의를 받을
    대상을 고르려면 "어느 판본에 동의했는가"를 알아야 한다. age-over-14처럼 문서가
    없는 항목은 비어 있다.
    """
    op.create_table('nl_user_consents',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=50), nullable=False),
    sa.Column('document_revision', sa.Date(), nullable=True),
    sa.Column('agreed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['nl_users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_nl_user_consents_user_code', 'nl_user_consents', ['user_id', 'code'], unique=False)


def downgrade() -> None:
    """동의 기록을 없앤다. 되돌리면 누가 무엇에 동의했는지가 사라진다."""
    op.drop_index('ix_nl_user_consents_user_code', table_name='nl_user_consents')
    op.drop_table('nl_user_consents')
