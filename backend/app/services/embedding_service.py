"""Embedding service — generates vector embeddings via OpenAI text-embedding-3-small (1536 dim)."""

import logging
from typing import List

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


def _has_valid_key(key: str) -> bool:
    if not key:
        return False
    if key.startswith("sk-CHANGE") or key.startswith("sk-ant-CHANGE"):
        return False
    return True


def _zero_vectors(n: int) -> List[List[float]]:
    return [[0.0] * settings.EMBEDDING_DIMENSION for _ in range(n)]


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts via OpenAI."""
    if not texts:
        return []

    if not _has_valid_key(settings.EMBEDDING_API_KEY):
        logger.warning("No valid EMBEDDING_API_KEY — returning zero vectors")
        return _zero_vectors(len(texts))

    try:
        from openai import OpenAI
    except ImportError:
        logger.error("openai SDK not installed — returning zero vectors")
        return _zero_vectors(len(texts))

    try:
        client = OpenAI(api_key=settings.EMBEDDING_API_KEY)
        response = client.embeddings.create(
            model=settings.EMBEDDING_MODEL_NAME,
            input=texts,
        )
        embeddings = [item.embedding for item in response.data]
        logger.info(f"Embedded {len(texts)} texts via OpenAI ({settings.EMBEDDING_MODEL_NAME})")
        return embeddings

    except Exception as e:
        logger.error(f"OpenAI embedding call failed: {e}")
        return _zero_vectors(len(texts))


def embed_query(query: str) -> List[float]:
    """Embed a single query string."""
    return embed_texts([query])[0]
