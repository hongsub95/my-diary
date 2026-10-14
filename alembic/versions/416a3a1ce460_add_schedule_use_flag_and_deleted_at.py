"""일정 삭제를 소프트 삭제로 처리하기 위한 use 플래그와 deleted_at 추가

Revision ID: 416a3a1ce460
Revises: d428a8fc5b37
Create Date: 2026-10-14 23:25:52.883362

일정 행을 바로 지우지 않는 이유: 외래키가 CASCADE라 행 하나를 지우면 장소·모든
작성자의 일기·사진·타임라인이 함께 사라진다. 공유 공간에서는 다른 사람이 남긴
기록까지 날아가는데, 잘못 누른 삭제를 되돌릴 길이 없다.

규칙은 계정 탈퇴(c8687d385185)와 같다. `use`로 지금 보이는 일정인지 가르고,
`deleted_at`으로 언제 지웠는지 남겨 보관 기간이 지난 일정을 파기할 기준으로 쓴다.

`use`에 인덱스를 따로 두지 않았다. 일정 조회는 전부 id 또는 (space_id, start_at)
인덱스로 행을 좁힌 뒤 use를 확인하는 형태라, 이미 걸러진 몇 행에만 적용된다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '416a3a1ce460'
down_revision: Union[str, Sequence[str], None] = 'd428a8fc5b37'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """nl_schedules에 use(0/1)와 deleted_at을 추가한다.

    server_default='1'을 두면 이미 있는 일정이 마이그레이션 시점에 전부 '사용 중'으로
    메워진다. 이게 없으면 NOT NULL 컬럼을 기존 행에 추가할 수 없다.
    """
    op.add_column('nl_schedules', sa.Column('use', sa.Integer(), server_default='1', nullable=False))
    op.add_column('nl_schedules', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """두 컬럼을 없앤다.

    되돌리면 삭제 기록이 사라진다. use=0이던 일정이 목록에 되살아나므로, 되돌리기 전에
    그 일정들을 어떻게 할지(실제로 지울지, 살릴지) 먼저 정해야 한다.
    """
    op.drop_column('nl_schedules', 'deleted_at')
    op.drop_column('nl_schedules', 'use')
