"""Initial migration

Revision ID: 33ea74a9b86d
Revises: 
Create Date: 2026-04-18 22:15:12.651916

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33ea74a9b86d'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create Enum manually using SQL for better control
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN CREATE TYPE userrole AS ENUM ('DEVELOPER', 'TEAM_LEAD', 'ADMIN'); END IF; END $$;")

    # 1. Create teams table without foreign keys first
    op.create_table('teams',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_by', sa.Integer(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )

    # 2. Create users table with FK to teams
    # We use a string for the Enum to avoid Alembic trying to create it again
    op.create_table('users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('hashed_password', sa.String(), nullable=False),
    sa.Column('full_name', sa.String(), nullable=True),
    sa.Column('role', sa.Enum('DEVELOPER', 'TEAM_LEAD', 'ADMIN', name='userrole'), nullable=False),
    sa.Column('team_id', sa.Integer(), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 3. Add foreign key to teams (cycle)
    op.create_foreign_key('fk_teams_created_by', 'teams', 'users', ['created_by'], ['id'])

    # 4. Create remaining tables
    op.create_table('standup_entries',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('did_yesterday', sa.Text(), nullable=False),
    sa.Column('doing_today', sa.Text(), nullable=False),
    sa.Column('blockers', sa.Text(), nullable=True),
    sa.Column('date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('weekly_summaries',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('week_start', sa.DateTime(timezone=True), nullable=False),
    sa.Column('summary_text', sa.Text(), nullable=False),
    sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('weekly_summaries')
    op.drop_table('standup_entries')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_table('teams')
    op.execute("DROP TYPE userrole")
