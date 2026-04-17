# db/models.py
import enum
from sqlalchemy import Column, Integer, String, Text, Enum, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class UserRole(str, enum.Enum):
    DEVELOPER = "developer"
    TEAM_LEAD = "team_lead"
    ADMIN = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(Enum(UserRole), default=UserRole.DEVELOPER, nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    standups = relationship("StandupEntry", back_populates="user")

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))

class StandupEntry(Base):
    __tablename__ = "standup_entries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    did_yesterday = Column(Text, nullable=False)
    doing_today = Column(Text, nullable=False)
    blockers = Column(Text, nullable=True)
    date = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="standups")

class WeeklySummary(Base):
    __tablename__ = "weekly_summaries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_start = Column(DateTime(timezone=True), nullable=False)
    summary_text = Column(Text, nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())