"""About Me / full user profile schemas — the single source of truth for the agents."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DailyLimits(BaseModel):
    calories: Optional[int] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    water_l: Optional[float] = None


class ProfileOut(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    dietary_constraints: List[str] = []
    allergies: List[str] = []
    medical_conditions: List[str] = []
    goals: List[str] = []
    liked_items: List[str] = []
    disliked_items: List[str] = []
    daily_limits: Dict[str, Any] = {}


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    dietary_constraints: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    medical_conditions: Optional[List[str]] = None
    goals: Optional[List[str]] = None
    liked_items: Optional[List[str]] = None
    disliked_items: Optional[List[str]] = None
    daily_limits: Optional[Dict[str, Any]] = None


class MealOut(BaseModel):
    id: str
    meal_name: str
    meal_type: Optional[str] = None
    calories: int = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    sugar_g: float = 0
    eaten_at: str
    source: str = "manual"
    extra: Dict[str, Any] = {}


class DayAggregate(BaseModel):
    date: str  # YYYY-MM-DD
    calories: int = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    sugar_g: float = 0
    sodium_mg: float = 0
    meal_count: int = 0


class DayDetail(BaseModel):
    date: str
    totals: DayAggregate
    meals: List[MealOut]


class AboutSummary(BaseModel):
    greeting: str
    i_know: List[str] = []
    recent_observations: List[str] = []
    safe_favorites: List[str] = []
    things_to_explore: List[str] = []
    encouragement: str
    meta: Dict[str, Any] = {}
