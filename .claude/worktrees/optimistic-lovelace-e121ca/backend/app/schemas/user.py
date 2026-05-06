from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class PreferencesUpdate(BaseModel):
    dietary_constraints: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    goals: Optional[List[str]] = None
    liked_items: Optional[List[str]] = None
    disliked_items: Optional[List[str]] = None


class PreferencesOut(BaseModel):
    dietary_constraints: List[str] = []
    allergies: List[str] = []
    goals: List[str] = []
    liked_items: List[str] = []
    disliked_items: List[str] = []

    class Config:
        from_attributes = True


class TrackCreate(BaseModel):
    track_type: str = Field(..., pattern="^(health_track|muscle_track|allergy_track)$")
    metrics: dict


class TrackOut(BaseModel):
    id: str
    track_type: str
    metrics: dict
    recorded_at: datetime

    class Config:
        from_attributes = True
