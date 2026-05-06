"""RAG service — embedding, ingestion, and vector search.

Uses pgvector for MVP. Abstracted so we can swap to Milvus/Pinecone later
by replacing the VectorStore implementation.
"""

import uuid
import logging
from typing import Any, Protocol

from sqlalchemy import create_engine, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Document, DocumentChunk
from app.schemas.schemas import IngestItem

settings = get_settings()
logger = logging.getLogger(__name__)


# ── Vector Store Protocol (swap target) ─────────────────
class VectorStore(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...
    def search(self, query_embedding: list[float], top_k: int) -> list[dict]: ...


# ── Embedding (stub) ───────────────────────────────────
def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings via API.
    TODO: Replace with actual API call using settings.EMBEDDING_API_KEY.
    """
    # Stub: return zero vectors of configured dimension
    dim = settings.EMBEDDING_DIM
    logger.warning("Using stub embeddings — replace with real embedding API call")
    return [[0.0] * dim for _ in texts]


def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    return embed_texts([query])[0]


# ── Ingestion (async, called from API) ─────────────────
async def ingest_documents(db: AsyncSession, source: str, items: list[IngestItem]) -> list[uuid.UUID]:
    """Chunk, embed, and upsert documents into pgvector."""
    doc_ids: list[uuid.UUID] = []

    for item in items:
        doc = Document(
            source=source,
            title=item.title,
            raw_content=item.content,
            metadata_=item.metadata,
        )
        db.add(doc)
        await db.flush()
        doc_ids.append(doc.id)

        # Simple chunking: split by double newline (MVP)
        chunks = _chunk_text(item.content)
        embeddings = embed_texts(chunks)

        for idx, (chunk_text, emb) in enumerate(zip(chunks, embeddings)):
            chunk = DocumentChunk(
                document_id=doc.id,
                chunk_index=idx,
                content=chunk_text,
                embedding=emb,
                metadata_=item.metadata,
            )
            db.add(chunk)

    await db.flush()
    logger.info(f"Ingested {len(doc_ids)} documents from source={source}")
    return doc_ids


# ── Search (sync, called from Celery worker) ──────────
def search_similar_chunks(query: str, top_k: int = 5) -> list[dict[str, Any]]:
    """Top-k vector similarity search using pgvector."""
    query_emb = embed_query(query)
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as db:
        # pgvector cosine distance: <=> operator
        sql = text("""
            SELECT id, document_id, content, chunk_index,
                   embedding <=> :query_emb AS distance
            FROM document_chunks
            ORDER BY embedding <=> :query_emb
            LIMIT :top_k
        """)
        rows = db.execute(sql, {"query_emb": str(query_emb), "top_k": top_k}).fetchall()

    results = []
    for row in rows:
        results.append({
            "chunk_id": str(row.id),
            "document_id": str(row.document_id),
            "content": row.content,
            "chunk_index": row.chunk_index,
            "distance": float(row.distance),
        })

    logger.info(f"Vector search returned {len(results)} results")
    return results


# ── Chunking helper ─────────────────────────────────────
def _chunk_text(text: str, max_chunk_size: int = 500) -> list[str]:
    """Split text into chunks. MVP: paragraph-based with size cap."""
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 2 > max_chunk_size and current:
            chunks.append(current.strip())
            current = para
        else:
            current = f"{current}\n\n{para}" if current else para

    if current.strip():
        chunks.append(current.strip())

    return chunks if chunks else [text[:max_chunk_size]]
