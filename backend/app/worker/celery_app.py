"""Celery application factory for HealAll background task processing."""

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "healall",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    # Retry tasks whose worker crashed before acknowledging
    task_acks_late=True,
    # Fair dispatch: each worker processes one task at a time before fetching the next
    worker_prefetch_multiplier=1,
    # Auto-discover tasks from the worker package
    include=["app.worker.tasks"],
)
