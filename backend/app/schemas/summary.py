from pydantic import BaseModel
from datetime import datetime

class SummaryBase(BaseModel):
    summary_text: str
    week_start: datetime

class SummaryOut(SummaryBase):
    id: int
    user_id: int
    generated_at: datetime

    class Config:
        from_attributes = True
