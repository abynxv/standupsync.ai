from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_admin
from app.schemas.user import UserOut
from typing import List

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/users", response_model=List[UserOut], dependencies=[Depends(get_current_admin)])
def get_all_users():
    return []
