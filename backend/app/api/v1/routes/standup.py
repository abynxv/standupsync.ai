from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.dependencies import get_current_user, get_current_team_lead
from app.db.models import User, UserRole
from app.schemas.standup import StandupCreate, StandupOut
from app.services import standup_service

router = APIRouter(prefix="/standups", tags=["Standups"])

@router.post("/", response_model=StandupOut, summary="Log today's standup")
def create_standup(
    standup_in: StandupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return standup_service.create_standup(db, standup_in, current_user.id)

@router.get("/", response_model=List[StandupOut], summary="Get own standups")
def get_my_standups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return standup_service.get_my_standups(db, current_user.id)

@router.put("/{standup_id}", response_model=StandupOut, summary="Edit today's standup")
def update_standup(
    standup_id: int,
    standup_in: StandupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return standup_service.update_standup(db, standup_id, standup_in, current_user.id)

@router.get("/team/{team_id}", response_model=List[StandupOut], summary="Get team standups")
def get_team_standups(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_team_lead)
):
    # RBAC check: Team Lead can only view their own team unless they are admin
    if current_user.role == UserRole.TEAM_LEAD and current_user.team_id != team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view standups for your own team."
        )
    return standup_service.get_team_standups(db, team_id)