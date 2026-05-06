import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import recommendations, feedback, rag, health

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.getLogger(__name__).info(f"Starting Foodvisor AI API (env={settings.APP_ENV})")
    yield
    logging.getLogger(__name__).info("Shutting down Foodvisor AI API")


app = FastAPI(
    title="Foodvisor AI",
    description="3-Agent AI Recommendation Platform",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(recommendations.router)
app.include_router(feedback.router)
app.include_router(rag.router)
