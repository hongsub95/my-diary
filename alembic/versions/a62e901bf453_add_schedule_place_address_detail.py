"""Add per-schedule place address detail."""

from alembic import op
import sqlalchemy as sa

revision = "a62e901bf453"
down_revision = "25837e2da5d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("nl_schedule_places", sa.Column("address_detail", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("nl_schedule_places", "address_detail")
