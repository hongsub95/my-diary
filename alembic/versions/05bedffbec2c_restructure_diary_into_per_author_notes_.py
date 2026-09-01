"""restructure diary into per author notes with shared photos and timeline

Revision ID: 05bedffbec2c
Revises: fb61fefe3cae
Create Date: 2026-09-02 00:16:03.084981

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '05bedffbec2c'
down_revision: Union[str, Sequence[str], None] = 'fb61fefe3cae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 사진 테이블의 schedule_id 외래키 이름. 이름을 정해둬야 downgrade에서 지목해 지울 수 있다.
PHOTO_SCHEDULE_FK = "fk_nl_diary_photos_schedule_id"


def upgrade() -> None:
    """일기를 작성자별 본문 + 하루 공용 사진·타임라인 구조로 바꾼다.

    바뀌는 것은 세 가지다.

    1. 본문: 일정당 1개 → 작성자당 1개. UNIQUE(schedule_id) 대신 (schedule_id, author_id)
    2. 사진: 본문이 아니라 일정에 직접 매단다. 두 사람이 올린 사진이 갈리면 하루의 대표
       사진을 누구 것에서 고를지 화면마다 정해야 한다
    3. 타임라인: 새로 만든다. 하루의 실제 방문 흐름은 하나이므로 역시 일정에 단다

    사진 컬럼을 NOT NULL로 추가하는데도 기본값을 주지 않는다. 일기 API가 아직 없어서
    두 테이블 모두 어느 환경에서도 행이 0개이기 때문이다. file_url/thumbnail_url을
    storage_key/thumbnail_key로 갈아끼우는 것도 같은 이유로 데이터 이관이 필요 없다.
    이름을 바꾸는 이유는 값이 URL이 아니라 저장 키인데 이름이 url이면 그대로
    <img src>에 넣는 실수가 나기 때문이다 (docs/API_SPEC.md 7장).
    """
    op.create_table('nl_diary_timeline',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('schedule_id', sa.Integer(), nullable=False),
    sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('schedule_place_id', sa.Integer(), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('memo', sa.Text(), nullable=True),
    sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['created_by'], ['nl_users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['schedule_id'], ['nl_schedules.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['schedule_place_id'], ['nl_schedule_places.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_nl_diary_timeline_created_by', 'nl_diary_timeline', ['created_by'], unique=False)
    op.create_index('ix_nl_diary_timeline_schedule_time', 'nl_diary_timeline', ['schedule_id', 'occurred_at', 'sort_order'], unique=False)
    op.drop_constraint(op.f('uq_diary_schedule'), 'nl_diary_entries', type_='unique')
    op.create_unique_constraint('uq_diary_schedule_author', 'nl_diary_entries', ['schedule_id', 'author_id'])
    op.add_column('nl_diary_photos', sa.Column('schedule_id', sa.Integer(), nullable=False))
    op.add_column('nl_diary_photos', sa.Column('storage_key', sa.String(length=500), nullable=False))
    op.add_column('nl_diary_photos', sa.Column('thumbnail_key', sa.String(length=500), nullable=True))
    op.add_column('nl_diary_photos', sa.Column('is_cover', sa.Boolean(), server_default='false', nullable=False))
    op.drop_index(op.f('ix_nl_diary_photos_entry_order'), table_name='nl_diary_photos')
    op.create_index('ix_nl_diary_photos_schedule_order', 'nl_diary_photos', ['schedule_id', 'sort_order'], unique=False)
    op.create_index('uq_nl_diary_photos_cover', 'nl_diary_photos', ['schedule_id'], unique=True, postgresql_where=sa.text('is_cover'))
    op.drop_constraint(op.f('diary_photos_diary_entry_id_fkey'), 'nl_diary_photos', type_='foreignkey')
    op.create_foreign_key(PHOTO_SCHEDULE_FK, 'nl_diary_photos', 'nl_schedules', ['schedule_id'], ['id'], ondelete='CASCADE')
    op.drop_column('nl_diary_photos', 'diary_entry_id')
    op.drop_column('nl_diary_photos', 'file_url')
    op.drop_column('nl_diary_photos', 'thumbnail_url')


def downgrade() -> None:
    """일정당 일기 1개 구조로 되돌린다.

    사진의 저장 키는 URL 컬럼으로 되돌릴 방법이 없다. 되돌리는 시점에 사진이 있다면
    그 값들은 복구되지 않으므로, 실데이터가 쌓인 뒤에는 이 downgrade를 쓰지 않는다.
    """
    op.add_column('nl_diary_photos', sa.Column('thumbnail_url', sa.VARCHAR(length=500), autoincrement=False, nullable=True))
    op.add_column('nl_diary_photos', sa.Column('file_url', sa.VARCHAR(length=500), autoincrement=False, nullable=False))
    op.add_column('nl_diary_photos', sa.Column('diary_entry_id', sa.INTEGER(), autoincrement=False, nullable=False))
    op.drop_constraint(PHOTO_SCHEDULE_FK, 'nl_diary_photos', type_='foreignkey')
    op.create_foreign_key(op.f('diary_photos_diary_entry_id_fkey'), 'nl_diary_photos', 'nl_diary_entries', ['diary_entry_id'], ['id'], ondelete='CASCADE')
    op.drop_index('uq_nl_diary_photos_cover', table_name='nl_diary_photos', postgresql_where=sa.text('is_cover'))
    op.drop_index('ix_nl_diary_photos_schedule_order', table_name='nl_diary_photos')
    op.create_index(op.f('ix_nl_diary_photos_entry_order'), 'nl_diary_photos', ['diary_entry_id', 'sort_order'], unique=False)
    op.drop_column('nl_diary_photos', 'is_cover')
    op.drop_column('nl_diary_photos', 'thumbnail_key')
    op.drop_column('nl_diary_photos', 'storage_key')
    op.drop_column('nl_diary_photos', 'schedule_id')
    op.drop_constraint('uq_diary_schedule_author', 'nl_diary_entries', type_='unique')
    op.create_unique_constraint(op.f('uq_diary_schedule'), 'nl_diary_entries', ['schedule_id'], postgresql_nulls_not_distinct=False)
    op.drop_index('ix_nl_diary_timeline_schedule_time', table_name='nl_diary_timeline')
    op.drop_index('ix_nl_diary_timeline_created_by', table_name='nl_diary_timeline')
    op.drop_table('nl_diary_timeline')
