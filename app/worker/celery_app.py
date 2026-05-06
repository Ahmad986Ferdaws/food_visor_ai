from celery import Celery
from app.config import get_settings

settings = get_settings()

celery = Celery(
    "foodvisor",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=120,
    task_time_limit=180,
    task_default_retry_delay=5,
    task_max_retries=2,
)

# Auto-discover tasks
celery.autodiscover_tasks(["app.worker"])
