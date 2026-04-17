# tasks/digest.py
from celery import shared_task
from celery.schedules import crontab
from app.services.ai_service import generate_summary
from app.services.email_service import send_digest_email
from app.db.session import SessionLocal
from app.db.models import User, StandupEntry, UserRole
from datetime import datetime, timedelta

@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def send_weekly_digests(self):
    db = SessionLocal()
    try:
        week_start = datetime.utcnow() - timedelta(days=7)
        users = db.query(User).filter(User.is_active == True).all()

        for user in users:
            entries = (
                db.query(StandupEntry)
                .filter(
                    StandupEntry.user_id == user.id,
                    StandupEntry.date >= week_start
                )
                .all()
            )
            if not entries:
                continue

            summary = generate_summary(entries)  # Calls OpenAI/Gemini
            send_digest_email(user.email, summary)

    except Exception as exc:
        raise self.retry(exc=exc)
    finally:
        db.close()


# In celery config (core/config.py):
# beat_schedule = {
#     "weekly-digest": {
#         "task": "app.tasks.digest.send_weekly_digests",
#         "schedule": crontab(hour=9, minute=0, day_of_week="friday"),
#     }
# }