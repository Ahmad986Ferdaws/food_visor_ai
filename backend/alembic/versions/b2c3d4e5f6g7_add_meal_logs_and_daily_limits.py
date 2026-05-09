"""add meal_logs table + daily_limits + display_name on user_preferences

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b2c3d4e5f6g7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_preferences",
        sa.Column("daily_limits", postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default=sa.text("'{}'::jsonb")),
    )
    op.add_column(
        "user_preferences",
        sa.Column("display_name", sa.String(length=255), nullable=True),
    )

    op.create_table(
        "meal_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("meal_name", sa.String(length=255), nullable=False),
        sa.Column("meal_type", sa.String(length=32), nullable=True),
        sa.Column("calories", sa.Integer(), nullable=True),
        sa.Column("protein_g", sa.Float(), nullable=True),
        sa.Column("carbs_g", sa.Float(), nullable=True),
        sa.Column("fat_g", sa.Float(), nullable=True),
        sa.Column("sugar_g", sa.Float(), nullable=True),
        sa.Column("eaten_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=True),
        sa.Column("extra", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_meal_logs_user_id", "meal_logs", ["user_id"])
    op.create_index("ix_meal_logs_eaten_at", "meal_logs", ["eaten_at"])
    op.create_index("ix_meal_logs_user_eaten", "meal_logs", ["user_id", "eaten_at"])


def downgrade() -> None:
    op.drop_index("ix_meal_logs_user_eaten", table_name="meal_logs")
    op.drop_index("ix_meal_logs_eaten_at", table_name="meal_logs")
    op.drop_index("ix_meal_logs_user_id", table_name="meal_logs")
    op.drop_table("meal_logs")
    op.drop_column("user_preferences", "display_name")
    op.drop_column("user_preferences", "daily_limits")
