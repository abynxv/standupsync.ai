from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_current_user, get_current_team_lead
from app.db.session import get_db
from app.db.models import WeeklySummary, User
from app.schemas.summary import SummaryOut

router = APIRouter(prefix="/summaries", tags=["Summaries"])


@router.get("/me", response_model=List[SummaryOut])
def get_my_summaries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(WeeklySummary)
        .filter(WeeklySummary.user_id == current_user.id)
        .order_by(WeeklySummary.generated_at.desc())
        .all()
    )


@router.get("/team", response_model=List[SummaryOut])
def get_team_summaries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_team_lead),
):
    if current_user.team_id is None:
        return []

    team_user_ids = [
        row.id
        for row in db.query(User.id).filter(User.team_id == current_user.team_id).all()
    ]
    return (
        db.query(WeeklySummary)
        .filter(WeeklySummary.user_id.in_(team_user_ids))
        .order_by(WeeklySummary.generated_at.desc())
        .all()
    )
