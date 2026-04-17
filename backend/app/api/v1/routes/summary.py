from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_team_lead
from app.schemas.summary import SummaryOut
from typing import List

router = APIRouter(prefix="/summaries", tags=["Summaries"])

@router.get("/me", response_model=List[SummaryOut])
def get_my_summaries():
    return []

@router.get("/team", response_model=List[SummaryOut], dependencies=[Depends(get_current_team_lead)])
def get_team_summaries():
    return []
