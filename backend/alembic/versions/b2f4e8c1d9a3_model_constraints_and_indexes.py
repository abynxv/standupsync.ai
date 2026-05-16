"""model constraints and indexes

Revision ID: b2f4e8c1d9a3
Revises: 33ea74a9b86d
Create Date: 2026-05-16 00:00:00.000000

Changes from the initial migration:
- teams.name: add UNIQUE constraint
- teams.created_by FK: add ON DELETE SET NULL
- standup_entries.date: add index (queried by date range on every standup load)
- standup_entries.user_id FK: add ON DELETE CASCADE
- weekly_summaries.user_id FK: add ON DELETE CASCADE
- weekly_summaries: add UNIQUE(user_id, week_start) — prevents duplicate digests for same week
- users.is_active: set NOT NULL with default TRUE (fill NULLs first)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b2f4e8c1d9a3'
down_revision: Union[str, Sequence[str], None] = '33ea74a9b86d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── teams ──────────────────────────────────────────────────────────────────
    # Add UNIQUE constraint on teams.name
    op.create_unique_constraint('uq_teams_name', 'teams', ['name'])

    # Drop old FK on teams.created_by and recreate with ON DELETE SET NULL
    op.drop_constraint('fk_teams_created_by', 'teams', type_='foreignkey')
    op.create_foreign_key(
        'fk_teams_created_by', 'teams', 'users',
        ['created_by'], ['id'],
        ondelete='SET NULL',
    )

    # ── users ──────────────────────────────────────────────────────────────────
    # Fill any NULL is_active values before adding NOT NULL constraint
    op.execute("UPDATE users SET is_active = TRUE WHERE is_active IS NULL")
    op.alter_column('users', 'is_active', nullable=False)

    # ── standup_entries ────────────────────────────────────────────────────────
    # Add index on date column (used in every standup query filter)
    op.create_index('ix_standup_entries_date', 'standup_entries', ['date'])

    # Drop old FK and recreate with ON DELETE CASCADE
    op.drop_constraint('standup_entries_user_id_fkey', 'standup_entries', type_='foreignkey')
    op.create_foreign_key(
        'standup_entries_user_id_fkey', 'standup_entries', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE',
    )

    # ── weekly_summaries ───────────────────────────────────────────────────────
    # Drop old FK and recreate with ON DELETE CASCADE
    op.drop_constraint('weekly_summaries_user_id_fkey', 'weekly_summaries', type_='foreignkey')
    op.create_foreign_key(
        'weekly_summaries_user_id_fkey', 'weekly_summaries', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE',
    )

    # Unique constraint: one summary per user per week
    op.create_unique_constraint(
        'uq_user_week_summary', 'weekly_summaries', ['user_id', 'week_start']
    )


def downgrade() -> None:
    op.drop_constraint('uq_user_week_summary', 'weekly_summaries', type_='unique')

    op.drop_constraint('weekly_summaries_user_id_fkey', 'weekly_summaries', type_='foreignkey')
    op.create_foreign_key(
        'weekly_summaries_user_id_fkey', 'weekly_summaries', 'users',
        ['user_id'], ['id'],
    )

    op.drop_constraint('standup_entries_user_id_fkey', 'standup_entries', type_='foreignkey')
    op.create_foreign_key(
        'standup_entries_user_id_fkey', 'standup_entries', 'users',
        ['user_id'], ['id'],
    )

    op.drop_index('ix_standup_entries_date', 'standup_entries')

    op.alter_column('users', 'is_active', nullable=True)

    op.drop_constraint('fk_teams_created_by', 'teams', type_='foreignkey')
    op.create_foreign_key(
        'fk_teams_created_by', 'teams', 'users', ['created_by'], ['id']
    )

    op.drop_constraint('uq_teams_name', 'teams', type_='unique')
