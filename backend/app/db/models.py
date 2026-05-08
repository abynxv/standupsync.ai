import enum

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class UserRole(str, enum.Enum):
    DEVELOPER = "developer"
    TEAM_LEAD = "team_lead"
    ADMIN = "admin"


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    members = relationship("User", back_populates="team", foreign_keys="User.team_id")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.DEVELOPER, nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    team = relationship("Team", back_populates="members", foreign_keys=[team_id])
    standups = relationship("StandupEntry", back_populates="user", cascade="all, delete-orphan")
    weekly_summaries = relationship("WeeklySummary", back_populates="user", cascade="all, delete-orphan")


class StandupEntry(Base):
    __tablename__ = "standup_entries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    did_yesterday = Column(Text, nullable=False)
    doing_today = Column(Text, nullable=False)
    blockers = Column(Text, nullable=True)
    date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    user = relationship("User", back_populates="standups")


class WeeklySummary(Base):
    __tablename__ = "weekly_summaries"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    week_start = Column(DateTime(timezone=True), nullable=False)
    summary_text = Column(Text, nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="weekly_summaries")

    __table_args__ = (
        UniqueConstraint("user_id", "week_start", name="uq_user_week_summary"),
    )
