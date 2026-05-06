"""Embedding service — generates vector embeddings via NVIDIA NIM API."""

import logging
from typing import List

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

NVIDIA_EMBED_URL = "https://integrate.api.nvidia.com/v1/embeddings"


def embed_texts(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of texts via NVIDIA NIM."""
    if not settings.EMBEDDING_API_KEY or settings.EMBEDDING_API_KEY.startswith("nvapi-CHANGE"):
        logger.warning("No valid EMBEDDING_API_KEY — returning zero vectors")
        dim = settings.EMBEDDING_DIMENSION
        return [[0.0] * dim for _ in texts]

    try:
        response = httpx.post(
            NVIDIA_EMBED_URL,
            headers={
                "Authorization": f"Bearer {settings.EMBEDDING_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "input": texts,
                "model": settings.EMBEDDING_MODEL_NAME,
                "input_type": "query",
                "encoding_format": "float",
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()

        embeddings = [item["embedding"] for item in data["data"]]
        logger.info(f"Embedded {len(texts)} texts via NVIDIA NIM ({settings.EMBEDDING_MODEL_NAME})")
        return embeddings

    except httpx.HTTPStatusError as e:
        logger.error(f"NVIDIA embedding API error {e.response.status_code}: {e.response.text[:200]}")
        dim = settings.EMBEDDING_DIMENSION
        return [[0.0] * dim for _ in texts]
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        dim = settings.EMBEDDING_DIMENSION
        return [[0.0] * dim for _ in texts]


def embed_query(query: str) -> List[float]:
    """Embed a single query string."""
    return embed_texts([query])[0]
