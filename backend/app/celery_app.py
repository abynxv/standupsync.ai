from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery("standupsync", broker=settings.CELERY_BROKER_URL)
celery_app.conf.update(
    result_backend=settings.CELERY_RESULT_BACKEND,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "weekly-digest-friday-9am": {
            "task": "app.tasks.digest.send_weekly_digests",
            "schedule": crontab(hour=9, minute=0, day_of_week="friday"),
        }
    },
)

celery_app.autodiscover_tasks(["app.tasks"])
