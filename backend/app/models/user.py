import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Float, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    tracks = relationship("UserTrack", back_populates="user", cascade="all, delete-orphan")
    requests = relationship("RecommendationRequest", back_populates="user", cascade="all, delete-orphan")
    meal_logs = relationship("MealLog", back_populates="user", cascade="all, delete-orphan")


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    dietary_constraints = Column(JSONB, default=list)   # ["vegetarian", "gluten-free"]
    allergies = Column(JSONB, default=list)              # ["peanuts", "shellfish"]
    goals = Column(JSONB, default=list)                  # ["muscle_gain", "weight_loss"]
    liked_items = Column(JSONB, default=list)
    disliked_items = Column(JSONB, default=list)
    daily_limits = Column(JSONB, default=dict)           # {calories, protein, carbs, fat, sugar, water_l}
    medical_conditions = Column(JSONB, default=list)     # ["type_2_diabetes", "hypertension"]
    display_name = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="preferences")


class UserTrack(Base):
    __tablename__ = "user_tracks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    track_type = Column(String(50), nullable=False)  # 'health_track' | 'muscle_track' | 'allergy_track'
    metrics = Column(JSONB, nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="tracks")


class MealLog(Base):
    """Logged meals — drives daily macro totals + history reasoning for the agents."""
    __tablename__ = "meal_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    meal_name = Column(String(255), nullable=False)
    meal_type = Column(String(32), nullable=True)  # breakfast | lunch | dinner | snack
    calories = Column(Integer, default=0)
    protein_g = Column(Float, default=0)
    carbs_g = Column(Float, default=0)
    fat_g = Column(Float, default=0)
    sugar_g = Column(Float, default=0)
    eaten_at = Column(DateTime(timezone=True), nullable=False, index=True)
    source = Column(String(32), default="manual")  # manual | ai_logged | photo
    extra = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="meal_logs")

    __table_args__ = (
        Index("ix_meal_logs_user_eaten", "user_id", "eaten_at"),
    )
