from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional


class StandupCreate(BaseModel):
    did_yesterday: str
    doing_today: str
    blockers: Optional[str] = None

    @field_validator("did_yesterday", "doing_today")
    @classmethod
    def not_empty_or_too_long(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty")
        if len(v) > 2000:
            raise ValueError("Field cannot exceed 2000 characters")
        return v

    @field_validator("blockers")
    @classmethod
    def blockers_max_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) > 2000:
                raise ValueError("Blockers cannot exceed 2000 characters")
            return v or None
        return v


class StandupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    did_yesterday: str
    doing_today: str
    blockers: Optional[str] = None
    date: datetime
