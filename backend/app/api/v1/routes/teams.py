from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_current_admin, get_current_team_lead
from app.db.models import Team, User, UserRole
from app.db.session import get_db
from app.schemas.team import TeamCreate, TeamMemberAdd, TeamOut
from app.schemas.user import UserOut

router = APIRouter(prefix="/teams", tags=["Teams"])


@router.post("/", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    team_in: TeamCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if db.query(Team).filter(Team.name == team_in.name).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A team named '{team_in.name}' already exists."
        )
    team = Team(name=team_in.name, created_by=current_admin.id)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.get("/", response_model=List[TeamOut])
def list_teams(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return db.query(Team).order_by(Team.id).all()


@router.get("/{team_id}", response_model=TeamOut)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    # Unassign all members before deleting
    db.query(User).filter(User.team_id == team_id).update({"team_id": None})
    db.delete(team)
    db.commit()


@router.get("/{team_id}/members", response_model=List[UserOut])
def get_team_members(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_team_lead),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Team leads can only view their own team; admins can view any
    if current_user.role == UserRole.TEAM_LEAD and current_user.team_id != team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view members of your own team."
        )

    return db.query(User).filter(User.team_id == team_id).order_by(User.full_name).all()


@router.post("/{team_id}/members", response_model=UserOut)
def add_team_member(
    team_id: int,
    member: TeamMemberAdd,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    user = db.query(User).filter(User.id == member.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.team_id = team_id
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team_member(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id, User.team_id == team_id).first()
    if not user:
        raise HTTPException(
            status_code=404, detail="User not found in this team"
        )
    user.team_id = None
    db.commit()
