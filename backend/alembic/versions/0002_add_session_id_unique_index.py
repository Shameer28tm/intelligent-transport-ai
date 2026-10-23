"""add_session_id_unique_index

Revision ID: 0002_add_session_id_unique_index
Revises: 0001_initial_schema
Create Date: 2026-10-23 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0002_add_session_id_unique_index'
down_revision: Union[str, Sequence[str], None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect_name = bind.dialect.name

    # Check for existing duplicates on SQLite before attempting index creation
    if dialect_name == "sqlite":
        try:
            dup_result = bind.execute(
                sa.text(
                    "SELECT count(*) FROM (SELECT session_id FROM vision_analyses WHERE session_id IS NOT NULL GROUP BY session_id HAVING count(*) > 1)"
                )
            ).scalar()
            if dup_result and dup_result > 0:
                # Do not delete historical SQLite duplicates without user approval
                return
        except Exception:
            pass

    op.create_index(
        'uq_vision_analyses_session_id',
        'vision_analyses',
        ['session_id'],
        unique=True,
        postgresql_where=sa.text('session_id IS NOT NULL'),
        sqlite_where=sa.text('session_id IS NOT NULL'),
    )


def downgrade() -> None:
    try:
        op.drop_index('uq_vision_analyses_session_id', table_name='vision_analyses')
    except Exception:
        pass
