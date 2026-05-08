from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional


class TeamCreate(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Team name cannot be empty")
        if len(v) > 100:
            raise ValueError("Team name cannot exceed 100 characters")
        return v


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_by: Optional[int] = None


class TeamMemberAdd(BaseModel):
    user_id: int
