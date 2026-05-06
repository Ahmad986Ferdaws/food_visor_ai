import redis
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db

router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health")
def health(db: Session = Depends(get_db)):
    db_ok = "unknown"
    redis_ok = "unknown"

    try:
        db.execute(text("SELECT 1"))
        db_ok = "ok"
    except Exception:
        db_ok = "error"

    try:
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        redis_ok = "ok"
    except Exception:
        redis_ok = "error"

    overall = "ok" if db_ok == "ok" and redis_ok == "ok" else "degraded"
    return {"status": overall, "env": settings.APP_ENV, "db": db_ok, "redis": redis_ok}
