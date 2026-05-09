"""User profile endpoints — the editable About Me view that drives the agents."""
from datetime import date as date_type, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User, UserPreferences, MealLog
from app.schemas.profile import (
    ProfileOut, ProfileUpdate, MealOut, DayAggregate, DayDetail, AboutSummary,
)
from app.agents.agent_advisor import run_advisor_summary

router = APIRouter(prefix="/users", tags=["users"])


def _ensure_prefs(db: Session, user: User) -> UserPreferences:
    prefs = user.preferences
    if prefs is None:
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


@router.get("/me/profile", response_model=ProfileOut)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = _ensure_prefs(db, current_user)
    return ProfileOut(
        id=str(current_user.id),
        email=current_user.email,
        display_name=prefs.display_name,
        dietary_constraints=prefs.dietary_constraints or [],
        allergies=prefs.allergies or [],
        medical_conditions=prefs.medical_conditions or [],
        goals=prefs.goals or [],
        liked_items=prefs.liked_items or [],
        disliked_items=prefs.disliked_items or [],
        daily_limits=prefs.daily_limits or {},
    )


@router.put("/me/profile", response_model=ProfileOut)
def update_my_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = _ensure_prefs(db, current_user)
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(prefs, field, value)
    db.commit()
    db.refresh(prefs)
    return ProfileOut(
        id=str(current_user.id),
        email=current_user.email,
        display_name=prefs.display_name,
        dietary_constraints=prefs.dietary_constraints or [],
        allergies=prefs.allergies or [],
        medical_conditions=prefs.medical_conditions or [],
        goals=prefs.goals or [],
        liked_items=prefs.liked_items or [],
        disliked_items=prefs.disliked_items or [],
        daily_limits=prefs.daily_limits or {},
    )


def _day_bounds(d: date_type):
    start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def _serialize_meal(m: MealLog) -> MealOut:
    return MealOut(
        id=str(m.id),
        meal_name=m.meal_name,
        meal_type=m.meal_type,
        calories=m.calories or 0,
        protein_g=m.protein_g or 0,
        carbs_g=m.carbs_g or 0,
        fat_g=m.fat_g or 0,
        sugar_g=m.sugar_g or 0,
        eaten_at=m.eaten_at.isoformat(),
        source=m.source or "manual",
        extra=m.extra or {},
    )


@router.get("/me/meals/by-date", response_model=DayDetail)
def get_meals_by_date(
    date: date_type = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start, end = _day_bounds(date)
    rows = (
        db.query(MealLog)
        .filter(MealLog.user_id == current_user.id)
        .filter(MealLog.eaten_at >= start)
        .filter(MealLog.eaten_at < end)
        .order_by(MealLog.eaten_at.asc())
        .all()
    )
    totals = DayAggregate(date=date.isoformat())
    for m in rows:
        totals.calories += m.calories or 0
        totals.protein_g += m.protein_g or 0
        totals.carbs_g += m.carbs_g or 0
        totals.fat_g += m.fat_g or 0
        totals.sugar_g += m.sugar_g or 0
        totals.sodium_mg += float((m.extra or {}).get("sodium_mg") or 0)
        totals.meal_count += 1
    return DayDetail(date=date.isoformat(), totals=totals, meals=[_serialize_meal(m) for m in rows])


@router.get("/me/meals/range", response_model=List[DayAggregate])
def get_meals_range(
    start: date_type = Query(...),
    end: date_type = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if end < start:
        raise HTTPException(status_code=400, detail="end must be >= start")
    if (end - start).days > 95:
        raise HTTPException(status_code=400, detail="range too large (max 95 days)")

    start_dt, _ = _day_bounds(start)
    _, end_dt = _day_bounds(end)
    rows = (
        db.query(MealLog)
        .filter(MealLog.user_id == current_user.id)
        .filter(MealLog.eaten_at >= start_dt)
        .filter(MealLog.eaten_at < end_dt)
        .all()
    )

    bucket: dict[str, DayAggregate] = {}
    cur = start
    while cur <= end:
        bucket[cur.isoformat()] = DayAggregate(date=cur.isoformat())
        cur += timedelta(days=1)

    for m in rows:
        key = m.eaten_at.astimezone(timezone.utc).date().isoformat()
        agg = bucket.get(key)
        if agg is None:
            continue
        agg.calories += m.calories or 0
        agg.protein_g += m.protein_g or 0
        agg.carbs_g += m.carbs_g or 0
        agg.fat_g += m.fat_g or 0
        agg.sugar_g += m.sugar_g or 0
        agg.sodium_mg += float((m.extra or {}).get("sodium_mg") or 0)
        agg.meal_count += 1

    return [bucket[k] for k in sorted(bucket.keys())]


@router.get("/me/about-summary", response_model=AboutSummary)
def get_about_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The Advisor agent's empathetic recap — drives the
    'How much do you know about me?' button on the About Me page."""
    summary = run_advisor_summary(db, current_user)
    # Coerce any LLM stragglers into our schema-friendly shape.
    return AboutSummary(
        greeting=str(summary.get("greeting") or "Hi there!"),
        i_know=[str(x) for x in (summary.get("i_know") or [])],
        recent_observations=[str(x) for x in (summary.get("recent_observations") or [])],
        safe_favorites=[str(x) for x in (summary.get("safe_favorites") or [])],
        things_to_explore=[str(x) for x in (summary.get("things_to_explore") or [])],
        encouragement=str(summary.get("encouragement") or "You're doing great — keep going."),
        meta=summary.get("meta") or {},
    )
