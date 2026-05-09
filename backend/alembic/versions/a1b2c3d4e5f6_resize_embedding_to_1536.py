"""resize embedding to 1536 (OpenAI text-embedding-3-small)

Revision ID: a1b2c3d4e5f6
Revises: 870a0abe3526
Create Date: 2026-05-06 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy.vector

# revision identifiers
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "870a0abe3526"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Vector dimension changes are not in-place compatible — drop & re-add the column.
    # Existing embeddings (if any) will be lost; re-run ingestion to repopulate.
    op.drop_column("rag_documents", "embedding")
    op.add_column(
        "rag_documents",
        sa.Column("embedding", pgvector.sqlalchemy.vector.VECTOR(dim=1536), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("rag_documents", "embedding")
    op.add_column(
        "rag_documents",
        sa.Column("embedding", pgvector.sqlalchemy.vector.VECTOR(dim=1024), nullable=True),
    )
