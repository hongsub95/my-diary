"""계정 탈퇴를 소프트 삭제로 처리하기 위한 use 플래그와 deleted_at 추가

Revision ID: c8687d385185
Revises: c3e81d47a9f2
Create Date: 2026-09-12 00:05:48.321099

탈퇴한 회원의 행을 지우지 않는 이유: 그 사람이 남긴 일기·사진·일정의 작성자를 되짚을
수 없게 되고, "탈퇴한 작성자의 항목은 읽기 전용으로 보존한다"는 정책
(docs/SPACE_MODEL_SPEC.md 13절)을 지킬 수 없다.

`use`만으로 "지금 쓸 수 있는 계정인가"는 알 수 있지만 "언제 지웠는가"는 모른다.
보관 기간이 지난 계정을 영구 삭제하는 정책(같은 문서 7.4절의 30일 권장)을 나중에
넣으려면 `deleted_at`이 필요해서 함께 둔다.

`use`에 인덱스를 두지 않았다. 이 값을 보는 조회는 전부 id나 email로 한 행을 집어온 뒤
확인하는 형태라 이미 유니크 인덱스를 탄다. 목록을 `use`로 거르는 화면이 생기면 그때
추가한다.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8687d385185'
down_revision: Union[str, Sequence[str], None] = 'c3e81d47a9f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """nl_users에 use(0/1)와 deleted_at을 추가한다.

    server_default='1'을 두면 이미 가입해 있는 회원도 마이그레이션 시점에 전부
    '사용 중'으로 메워진다. 이게 없으면 NOT NULL 컬럼을 기존 행에 추가할 수 없다.
    """
    op.add_column('nl_users', sa.Column('use', sa.Integer(), server_default='1', nullable=False))
    op.add_column('nl_users', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """두 컬럼을 없앤다.

    되돌리면 탈퇴 기록이 사라진다. use=0이던 계정이 되살아나므로, 되돌리기 전에
    그 계정들을 어떻게 할지 먼저 정해야 한다.
    """
    op.drop_column('nl_users', 'deleted_at')
    op.drop_column('nl_users', 'use')
