import logging
from datetime import datetime, timedelta

from celery import shared_task

from app.db.models import StandupEntry, User, WeeklySummary
from app.db.session import SessionLocal
from app.services.ai_service import generate_summary
from app.services.email_service import send_digest_email

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def send_weekly_digests(self):
    db = SessionLocal()
    try:
        week_start = datetime.utcnow() - timedelta(days=7)
        users = db.query(User).filter(User.is_active == True).all()
        logger.info(f"Running weekly digest for {len(users)} active users")

        for user in users:
            # Each user is isolated — one failure does not abort others
            try:
                entries = (
                    db.query(StandupEntry)
                    .filter(
                        StandupEntry.user_id == user.id,
                        StandupEntry.date >= week_start,
                    )
                    .all()
                )
                if not entries:
                    logger.debug(f"No entries for user {user.id} this week, skipping")
                    continue

                summary_text = generate_summary(entries)

                db.add(
                    WeeklySummary(
                        user_id=user.id,
                        week_start=week_start,
                        summary_text=summary_text,
                    )
                )
                db.commit()

                send_digest_email(user.email, summary_text)
                logger.info(f"Digest sent and saved for user {user.id}")

            except Exception as user_exc:
                db.rollback()
                logger.error(f"Digest failed for user {user.id}: {user_exc}", exc_info=True)

    except Exception as exc:
        raise self.retry(exc=exc)
    finally:
        db.close()
