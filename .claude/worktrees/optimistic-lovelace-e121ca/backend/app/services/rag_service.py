"""RAG service — vector search against pgvector.

Uses pgvector for MVP. Abstracted for future Milvus swap.
"""

import logging
from typing import List, Dict, Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def retrieve_documents(
    db: Session,
    query_embedding: List[float],
    top_k: int | None = None,
) -> List[Dict[str, Any]]:
    """Top-k vector similarity search using pgvector cosine distance."""
    top_k = top_k or settings.RAG_TOP_K

    sql = text("""
        SELECT id, content, metadata,
               1 - (embedding <=> :query_emb::vector) AS similarity
        FROM rag_documents
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> :query_emb::vector
        LIMIT :top_k
    """)

    try:
        rows = db.execute(sql, {"query_emb": str(query_embedding), "top_k": top_k}).fetchall()
    except Exception as e:
        logger.warning(f"RAG retrieval failed: {e}")
        # CRITICAL: rollback the broken transaction so the session stays usable
        db.rollback()
        return []

    results = []
    for row in rows:
        similarity = float(row.similarity) if row.similarity else 0.0
        if similarity >= settings.RAG_SIMILARITY_THRESHOLD:
            results.append({
                "id": str(row.id),
                "content": row.content,
                "metadata": row.metadata,
                "similarity": similarity,
            })

    logger.info(f"RAG retrieved {len(results)} documents (threshold={settings.RAG_SIMILARITY_THRESHOLD})")
    return results
