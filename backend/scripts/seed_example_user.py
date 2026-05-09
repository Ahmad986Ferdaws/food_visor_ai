"""Seed an example user (you@example.com / Alex / test1234) with rich, realistic data
so the full agent pipeline can be exercised end-to-end.

Idempotent — safe to run repeatedly. It will:
  • Create or refresh the user
  • Replace UserPreferences with the demo profile
  • Wipe & re-seed 7 days of meal logs (3+ per day) including today's breakfast
  • Insert 10 past recommendation runs with realistic agent outputs

Run from inside the api / worker container:

    docker compose exec api python -m scripts.seed_example_user
"""

import os
import sys
import logging
from datetime import datetime, timezone, timedelta

# Make `app` importable when run as a script (PYTHONPATH=/app in Docker)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user import User, UserPreferences, MealLog
from app.models.recommendation import RecommendationRequest, AgentOutput, RequestStatus
from app.utils.security import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("seed")


EMAIL = "you@example.com"
PASSWORD = "test1234"
NAME = "Alex"

PROFILE = {
    "dietary_constraints": ["vegetarian"],
    "allergies": ["gluten", "nuts"],
    "goals": ["lose_0.5kg_per_week", "hit_120g_protein_daily", "drink_2.5L_water_daily"],
    "liked_items": ["Greek yogurt", "lentil soup", "quinoa bowls", "avocado toast",
                    "smoothies", "hummus", "falafel"],
    "disliked_items": ["tofu", "Brussels sprouts", "protein bars"],
    "daily_limits": {
        "calories": 2000,
        "protein_g": 150,
        "carbs_g": 250,
        "fat_g": 65,
        "sugar_g": 30,
        "water_l": 2.5,
    },
    "display_name": NAME,
}

# 7-day rolling history. Each tuple: meal_type, name, kcal, P, C, F, sugar
DAY_TEMPLATES = [
    # Heavy day (close to limit)
    [
        ("breakfast", "Greek yogurt parfait with berries & oats", 380, 22, 48, 9, 18),
        ("lunch",     "Mediterranean lentil soup with avocado toast", 620, 28, 70, 22, 8),
        ("snack",     "Hummus & veggie sticks", 220, 8, 24, 11, 4),
        ("dinner",    "Quinoa bowl with roasted vegetables & tahini", 690, 26, 80, 24, 7),
    ],
    # Light day
    [
        ("breakfast", "Smoothie with spinach, banana & almond butter", 320, 15, 42, 10, 22),
        ("lunch",     "Falafel salad with tahini drizzle", 540, 22, 56, 24, 5),
        ("dinner",    "Chickpea curry with brown rice", 580, 22, 78, 16, 9),
    ],
    # Moderate day
    [
        ("breakfast", "Avocado toast with poached egg", 420, 18, 36, 22, 3),
        ("lunch",     "Lentil & sweet potato soup", 480, 20, 62, 14, 8),
        ("snack",     "Greek yogurt with honey", 180, 12, 22, 4, 18),
        ("dinner",    "Stuffed bell peppers with quinoa & black beans", 580, 24, 72, 20, 9),
    ],
    # Low-protein day (caught by Agent 3 ideally)
    [
        ("breakfast", "Oatmeal with banana & cinnamon", 360, 10, 60, 8, 14),
        ("lunch",     "Caprese salad with balsamic", 410, 18, 14, 28, 6),
        ("dinner",    "Veggie pasta primavera (gluten-free)", 540, 18, 78, 14, 7),
    ],
    # High-protein day
    [
        ("breakfast", "Greek yogurt smoothie bowl with chia seeds", 480, 32, 52, 12, 22),
        ("lunch",     "Lentil & chickpea power bowl", 620, 36, 72, 18, 7),
        ("snack",     "Cottage cheese with berries", 220, 22, 18, 6, 12),
        ("dinner",    "Tempeh stir-fry with quinoa", 640, 38, 64, 22, 6),
    ],
    # Light, low-cal day
    [
        ("breakfast", "Berry chia pudding", 280, 12, 32, 10, 16),
        ("lunch",     "Big garden salad with chickpeas", 380, 18, 36, 16, 7),
        ("dinner",    "Vegetable & lentil stew", 460, 22, 56, 12, 8),
    ],
    # Yesterday — varied
    [
        ("breakfast", "Avocado toast with feta", 380, 14, 38, 18, 4),
        ("lunch",     "Falafel wrap (corn tortilla)", 560, 22, 64, 22, 6),
        ("snack",     "Apple with sunflower butter", 240, 6, 28, 12, 18),
        ("dinner",    "Coconut curry chickpeas with rice", 660, 22, 86, 22, 10),
    ],
]


def upsert_user(db) -> User:
    user = db.query(User).filter_by(email=EMAIL).first()
    if user:
        log.info(f"User {EMAIL} already exists (id={user.id}) — refreshing")
        user.password_hash = hash_password(PASSWORD)
        user.email_verified = True
    else:
        user = User(
            email=EMAIL,
            password_hash=hash_password(PASSWORD),
            email_verified=True,
        )
        db.add(user)
        db.flush()
        log.info(f"Created user {EMAIL} (id={user.id})")
    return user


def upsert_preferences(db, user: User):
    prefs = db.query(UserPreferences).filter_by(user_id=user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=user.id)
        db.add(prefs)
    for k, v in PROFILE.items():
        setattr(prefs, k, v)
    db.flush()
    log.info(f"Preferences set: allergies={PROFILE['allergies']}, "
             f"limits.cal={PROFILE['daily_limits']['calories']}, "
             f"limits.protein={PROFILE['daily_limits']['protein_g']}")


def reseed_meal_logs(db, user: User):
    deleted = db.query(MealLog).filter_by(user_id=user.id).delete()
    if deleted:
        log.info(f"Cleared {deleted} existing meal logs")

    now = datetime.now(timezone.utc)
    inserted = 0

    # Days 1-6 ago: full days (use DAY_TEMPLATES[0..5])
    for days_ago in range(7, 0, -1):
        template = DAY_TEMPLATES[(7 - days_ago) % len(DAY_TEMPLATES)]
        day_base = now - timedelta(days=days_ago)
        for slot_idx, (mtype, mname, kcal, p, c, f, s) in enumerate(template):
            # spread meals across morning / midday / evening
            hour = {"breakfast": 8, "lunch": 13, "snack": 16, "dinner": 19}.get(mtype, 12)
            eaten_at = day_base.replace(hour=hour, minute=15, second=0, microsecond=0)
            db.add(MealLog(
                user_id=user.id, meal_name=mname, meal_type=mtype,
                calories=kcal, protein_g=p, carbs_g=c, fat_g=f, sugar_g=s,
                eaten_at=eaten_at, source="manual",
            ))
            inserted += 1

    # Today: only breakfast logged so the agents see a real "remaining budget"
    today_breakfast = now.replace(hour=8, minute=15, second=0, microsecond=0)
    db.add(MealLog(
        user_id=user.id,
        meal_name="Oatmeal with banana, cinnamon, and a drizzle of honey",
        meal_type="breakfast",
        calories=420, protein_g=12, carbs_g=72, fat_g=8, sugar_g=18,
        eaten_at=today_breakfast, source="manual",
    ))
    inserted += 1

    db.flush()
    log.info(f"Seeded {inserted} meal logs across 7 days + today's breakfast")


def reseed_recommendation_history(db, user: User):
    deleted = db.query(RecommendationRequest).filter_by(user_id=user.id).delete()
    if deleted:
        log.info(f"Cleared {deleted} existing recommendation requests")

    samples = [
        ("High-protein vegetarian lunch under 600 calories", False,
         {"meal_name": "Lentil & quinoa power bowl", "protein": 32, "calories": 540}),
        ("Light dinner that fits my remaining budget", False,
         {"meal_name": "Chickpea & spinach curry with brown rice", "protein": 22, "calories": 480}),
        ("Quick post-workout snack", False,
         {"meal_name": "Greek yogurt with berries & seeds", "protein": 22, "calories": 220}),
        ("Can I eat what's in this photo?", True,
         {"meal_name": "Falafel wrap (gluten-free)", "decision": "can_eat"}),
        ("Anti-inflammatory dinner ideas", False,
         {"meal_name": "Roasted vegetable & tahini bowl", "protein": 18, "calories": 520}),
        ("Higher-protein breakfast ideas", False,
         {"meal_name": "Cottage cheese with berries & chia", "protein": 26, "calories": 320}),
        ("Photo: is this safe for me?", True,
         {"meal_name": "Roasted-pepper hummus plate", "decision": "cannot_eat",
          "verdict_reason": "The pita on the plate contains gluten."}),
        ("Lighter lunch — staying under 500 cal", False,
         {"meal_name": "Big garden salad with chickpeas", "protein": 18, "calories": 380}),
        ("Hit my protein goal today", False,
         {"meal_name": "Tempeh stir-fry with quinoa", "protein": 38, "calories": 640}),
        ("Mediterranean dinner suggestion", False,
         {"meal_name": "Stuffed bell peppers with white beans", "protein": 22, "calories": 510}),
    ]

    base = datetime.now(timezone.utc) - timedelta(days=10)
    for i, (msg, has_photo, snapshot) in enumerate(samples):
        created = base + timedelta(days=i, hours=11)
        completed = created + timedelta(seconds=14)
        ctx_override = {"photo_data_url": "data:image/jpeg;base64,(omitted)", "photo_filename": "meal.jpg"} if has_photo else None
        req = RecommendationRequest(
            user_id=user.id,
            message=msg,
            context_override=ctx_override,
            sensitive_mode=False,
            status=RequestStatus.COMPLETED,
            created_at=created,
            completed_at=completed,
        )
        db.add(req)
        db.flush()

        # Minimal Agent 3 output (matches new shape) so history reads cleanly.
        agent3_output = {
            "decision": snapshot.get("decision", "try_alternative"),
            "verdict_reason": snapshot.get("verdict_reason", "Fits your day."),
            "validation_result": "approved",
            "final_recommendation": {
                "meal_name": snapshot.get("meal_name", "Recommended meal"),
                "description": "Seeded historical recommendation.",
                "ingredients": [],
                "nutrition": {
                    "calories": snapshot.get("calories", 500),
                    "protein": snapshot.get("protein", 20),
                    "carbs": 50, "fat": 15, "sugar": 6,
                },
                "preparation": "Seed entry — see meal_name.",
                "prep_time_minutes": 20,
                "tags": ["Vegetarian", "Seeded"],
            },
            "changes_made": [],
            "confidence_score": 0.9,
        }
        db.add(AgentOutput(
            request_id=req.id, agent_number=1,
            output={"intent": "seed", "remaining_budget": {"calories": 1200}},
            tokens_used=0, latency_ms=120,
        ))
        db.add(AgentOutput(
            request_id=req.id, agent_number=2,
            output=agent3_output["final_recommendation"],
            tokens_used=0, latency_ms=900,
        ))
        db.add(AgentOutput(
            request_id=req.id, agent_number=3,
            output=agent3_output,
            tokens_used=0, latency_ms=600,
        ))

    db.flush()
    log.info(f"Seeded {len(samples)} recommendation requests with agent outputs")


def main():
    db = SessionLocal()
    try:
        user = upsert_user(db)
        upsert_preferences(db, user)
        reseed_meal_logs(db, user)
        reseed_recommendation_history(db, user)
        db.commit()
        log.info(f"✅ Seed complete for {EMAIL} (id={user.id})")
    except Exception:
        db.rollback()
        log.exception("Seed FAILED — rolled back")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
