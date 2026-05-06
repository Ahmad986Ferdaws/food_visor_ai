from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://foodvisor:foodvisor@postgres:5432/foodvisor"
    DATABASE_URL_SYNC: str = "postgresql://foodvisor:foodvisor@postgres:5432/foodvisor"

    # Redis / Celery
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # Agent 1: Context Builder
    AGENT1_MODEL_PROVIDER: str = "openai"
    AGENT1_API_KEY: str = ""

    # Agent 2: Recommender
    AGENT2_MODEL_PROVIDER: str = "openai"
    AGENT2_API_KEY: str = ""

    # Agent 3: Validator
    AGENT3_MODEL_PROVIDER: str = "openai"
    AGENT3_API_KEY: str = ""

    # Embeddings
    EMBEDDING_API_KEY: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIM: int = 1536

    # Reranker (optional)
    RERANKER_API_KEY: str = ""
    RERANKER_MODEL: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
