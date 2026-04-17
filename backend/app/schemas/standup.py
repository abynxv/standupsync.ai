from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class StandupBase(BaseModel):
    did_yesterday: str
    doing_today: str
    blockers: Optional[str] = None

class StandupCreate(StandupBase):
    pass

class StandupOut(StandupBase):
    id: int
    user_id: int
    date: datetime

    class Config:
        from_attributes = True
