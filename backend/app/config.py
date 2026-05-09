from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "FoodVisor AI"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "postgresql://foodvisor:foodvisor_dev@postgres:5432/foodvisor"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    # Agent 1 — Context Builder (Anthropic)
    AGENT1_MODEL_PROVIDER: str = "anthropic"
    AGENT1_MODEL_NAME: str = "claude-sonnet-4-6"
    AGENT1_API_KEY: str = ""

    # Agent 2 — Recommender (OpenAI)
    AGENT2_MODEL_PROVIDER: str = "openai"
    AGENT2_MODEL_NAME: str = "gpt-5.4"
    AGENT2_API_KEY: str = ""

    # Agent 3 — Validator (Anthropic)
    AGENT3_MODEL_PROVIDER: str = "anthropic"
    AGENT3_MODEL_NAME: str = "claude-sonnet-4-6"
    AGENT3_API_KEY: str = ""

    # Embeddings (OpenAI)
    EMBEDDING_MODEL_PROVIDER: str = "openai"
    EMBEDDING_MODEL_NAME: str = "text-embedding-3-small"
    EMBEDDING_API_KEY: str = ""
    EMBEDDING_DIMENSION: int = 1536

    # RAG
    RAG_TOP_K: int = 5
    RAG_SIMILARITY_THRESHOLD: float = 0.7
    RAG_CHUNK_SIZE: int = 512
    RAG_CHUNK_OVERLAP: int = 50

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"

    # Timeouts (seconds)
    AGENT_TIMEOUT: int = 30
    TASK_TIMEOUT: int = 120

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
