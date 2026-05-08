from datetime import date, datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.db.models import StandupEntry, User
from app.schemas.standup import StandupCreate


def _today_start() -> datetime:
    return datetime.combine(date.today(), datetime.min.time())


def get_today_standup(db: Session, user_id: int) -> Optional[StandupEntry]:
    return (
        db.query(StandupEntry)
        .filter(
            StandupEntry.user_id == user_id,
            StandupEntry.date >= _today_start(),
        )
        .first()
    )


def create_standup(db: Session, standup_in: StandupCreate, user_id: int) -> StandupEntry:
    if get_today_standup(db, user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already logged a standup for today. Use PUT to edit it.",
        )

    db_standup = StandupEntry(
        user_id=user_id,
        did_yesterday=standup_in.did_yesterday,
        doing_today=standup_in.doing_today,
        blockers=standup_in.blockers,
    )
    db.add(db_standup)
    db.commit()
    db.refresh(db_standup)
    return db_standup


def get_my_standups(db: Session, user_id: int, limit: int = 30, skip: int = 0) -> List[StandupEntry]:
    return (
        db.query(StandupEntry)
        .filter(StandupEntry.user_id == user_id)
        .order_by(StandupEntry.date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def update_standup(db: Session, standup_id: int, standup_in: StandupCreate, user_id: int) -> StandupEntry:
    db_standup = (
        db.query(StandupEntry)
        .filter(StandupEntry.id == standup_id, StandupEntry.user_id == user_id)
        .first()
    )
    if not db_standup:
        raise HTTPException(status_code=404, detail="Standup entry not found")

    if db_standup.date.date() != date.today():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit a standup on the same day it was created.",
        )

    db_standup.did_yesterday = standup_in.did_yesterday
    db_standup.doing_today = standup_in.doing_today
    db_standup.blockers = standup_in.blockers
    db.commit()
    db.refresh(db_standup)
    return db_standup


def delete_standup(db: Session, standup_id: int, user_id: int) -> None:
    db_standup = (
        db.query(StandupEntry)
        .filter(StandupEntry.id == standup_id, StandupEntry.user_id == user_id)
        .first()
    )
    if not db_standup:
        raise HTTPException(status_code=404, detail="Standup entry not found")

    if db_standup.date.date() != date.today():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete a standup on the same day it was created.",
        )

    db.delete(db_standup)
    db.commit()


def get_team_standups(db: Session, team_id: int, limit: int = 50, skip: int = 0) -> List[StandupEntry]:
    return (
        db.query(StandupEntry)
        .join(User)
        .filter(User.team_id == team_id)
        .order_by(StandupEntry.date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
