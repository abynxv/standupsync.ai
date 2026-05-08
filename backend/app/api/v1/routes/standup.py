from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_team_lead, get_current_user
from app.db.models import User, UserRole
from app.db.session import get_db
from app.schemas.standup import StandupCreate, StandupOut
from app.services import standup_service

router = APIRouter(prefix="/standups", tags=["Standups"])


@router.get("/today", response_model=Optional[StandupOut], summary="Get today's standup (null if not yet submitted)")
def get_today_standup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return standup_service.get_today_standup(db, current_user.id)


@router.post("/", response_model=StandupOut, status_code=status.HTTP_201_CREATED, summary="Log today's standup")
def create_standup(
    standup_in: StandupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return standup_service.create_standup(db, standup_in, current_user.id)


@router.get("/", response_model=List[StandupOut], summary="Get own standup history")
def get_my_standups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(default=30, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
):
    return standup_service.get_my_standups(db, current_user.id, limit=limit, skip=skip)


@router.put("/{standup_id}", response_model=StandupOut, summary="Edit today's standup")
def update_standup(
    standup_id: int,
    standup_in: StandupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return standup_service.update_standup(db, standup_id, standup_in, current_user.id)


@router.delete("/{standup_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete today's standup")
def delete_standup(
    standup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    standup_service.delete_standup(db, standup_id, current_user.id)


@router.get("/team/{team_id}", response_model=List[StandupOut], summary="Get team standups (team leads only)")
def get_team_standups(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_team_lead),
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
):
    if current_user.role == UserRole.TEAM_LEAD and current_user.team_id != team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view standups for your own team.",
        )
    return standup_service.get_team_standups(db, team_id, limit=limit, skip=skip)
