from pydantic import BaseModel, ConfigDict
from datetime import datetime


class SummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    week_start: datetime
    summary_text: str
    generated_at: datetime
