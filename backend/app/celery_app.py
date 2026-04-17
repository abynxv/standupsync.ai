from celery import Celery
from app.core.config import settings

celery_app = Celery("standupsync", broker=settings.CELERY_BROKER_URL)
celery_app.conf.update(
    result_backend=settings.CELERY_RESULT_BACKEND,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Celery Beat schedule is configured here or in main
    beat_schedule = {
        "weekly-digest": {
            "task": "app.tasks.digest.send_weekly_digests",
            "schedule": 60.0 * 60 * 24 * 7,  # weekly (better use crontab in real app)
        }
    }
)

celery_app.autodiscover_tasks(["app.tasks"])
