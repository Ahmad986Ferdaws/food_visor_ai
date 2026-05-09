"""Seed Maria Santos — a 52-year-old user with Type 2 Diabetes, severe nut allergies,
celiac disease, and 30 days of meal history. Idempotent.

Run: docker compose exec api python -m scripts.seed_maria
"""

import os
import sys
import logging
import random
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user import User, UserPreferences, MealLog
from app.models.recommendation import RecommendationRequest, AgentOutput, RequestStatus
from app.utils.security import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("seed_maria")

EMAIL = "maria.santos@foodvisor.ai"
PASSWORD = "Wellness2026!"
NAME = "Maria"

# Maria's full profile. The medical condition is encoded as a goal
# ("type_2_diabetes_management") and as a dietary_constraint ("diabetic-friendly")
# so all three agents pick it up. Sodium lives in daily_limits as a flexible JSONB key.
PROFILE = {
    "display_name": NAME,
    "dietary_constraints": ["gluten-free", "diabetic-friendly", "low-sodium"],
    "allergies": ["peanuts", "tree nuts", "almonds", "cashews", "walnuts", "pecans", "gluten", "wheat"],
    "goals": [
        "type_2_diabetes_management",
        "maintain_blood_sugar_below_140_postprandial",
        "weight_maintenance_70kg",
        "sodium_under_1500mg",
        "consistent_protein_per_meal",
    ],
    "liked_items": [
        "steel-cut oats", "berries", "Greek yogurt", "grilled salmon", "quinoa bowls",
        "roasted chicken thigh", "lentil soup", "spinach", "avocado", "olive oil",
        "tomatoes", "cucumber", "hummus (gluten-free)", "rice cakes", "eggs",
    ],
    "disliked_items": [
        "tofu", "soy milk", "Brussels sprouts", "liver", "cottage cheese (large amounts)",
        "artificial sweeteners",
    ],
    "daily_limits": {
        "calories": 1800,
        "protein_g": 100,
        "carbs_g": 150,           # diabetes-managed
        "fat_g": 60,
        "sugar_g": 25,            # tight cap
        "sodium_mg": 1500,        # cardiovascular target
        "water_l": 2.0,
    },
}

# (meal_type, meal_name, kcal, P, C, F, sugar, sodium_mg) — all gluten-free + diabetic-safe
SAFE_MEAL_BANK = {
    "breakfast": [
        ("Steel-cut oats with blueberries & chia seeds", 320, 12, 52, 8, 12, 180),
        ("Greek yogurt parfait with raspberries & flax", 290, 22, 28, 9, 14, 95),
        ("Two scrambled eggs with sautéed spinach & avocado", 360, 20, 12, 26, 2, 320),
        ("Veggie omelette with tomato & feta", 340, 24, 8, 22, 4, 410),
        ("Greek yogurt with chia, berries, and a drizzle of olive oil", 270, 20, 22, 10, 12, 110),
        ("Cottage cheese (small) with cucumber & tomato", 260, 24, 14, 10, 8, 380),
        ("Smoothie: spinach, Greek yogurt, frozen berries, oat milk", 310, 20, 36, 8, 18, 140),
    ],
    "lunch": [
        ("Quinoa bowl with grilled chicken, spinach & tahini", 520, 36, 48, 18, 4, 480),
        ("Lentil & vegetable soup with rice cakes", 460, 22, 56, 12, 6, 520),
        ("Grilled salmon salad with mixed greens & olive oil", 510, 34, 18, 28, 4, 350),
        ("Roasted chicken thigh, brown rice & roasted broccoli", 540, 32, 50, 18, 3, 460),
        ("Greek-style salad with feta, olives, cucumber & grilled chicken", 490, 30, 18, 28, 6, 720),
        ("Quinoa-stuffed bell peppers with black beans & avocado", 500, 22, 62, 18, 8, 420),
        ("Tuna salad on rice cakes with greens", 470, 32, 32, 22, 3, 510),
    ],
    "snack": [
        ("Apple slices with sunflower seed butter", 180, 5, 24, 9, 18, 80),
        ("Carrot & cucumber sticks with hummus", 160, 6, 18, 8, 6, 280),
        ("Greek yogurt with cinnamon (small)", 130, 15, 8, 4, 6, 65),
        ("Hard-boiled egg & cherry tomatoes", 110, 9, 4, 7, 3, 120),
        ("Rice cake with avocado & sea salt", 150, 4, 16, 9, 1, 140),
    ],
    "dinner": [
        ("Grilled salmon, quinoa, and steamed asparagus", 580, 42, 42, 22, 4, 380),
        ("Chicken & vegetable stir-fry with brown rice (no soy)", 550, 36, 56, 16, 6, 420),
        ("Stuffed zucchini boats with quinoa & ground turkey", 510, 38, 44, 18, 5, 460),
        ("Lentil & sweet potato curry with brown rice", 540, 24, 76, 14, 9, 380),
        ("Pan-seared cod with roasted vegetables & mashed cauliflower", 470, 36, 24, 22, 6, 410),
        ("Roasted chicken breast, quinoa pilaf & green beans", 530, 40, 44, 16, 4, 400),
        ("Vegetable & lentil chili (gluten-free) with avocado", 510, 24, 64, 16, 8, 480),
    ],
}


def upsert_user(db) -> User:
    user = db.query(User).filter_by(email=EMAIL).first()
    if user:
        log.info(f"User {EMAIL} already exists — refreshing")
        user.password_hash = hash_password(PASSWORD)
        user.email_verified = True
    else:
        user = User(email=EMAIL, password_hash=hash_password(PASSWORD), email_verified=True)
        db.add(user); db.flush()
        log.info(f"Created user {EMAIL} (id={user.id})")
    return user


def upsert_preferences(db, user: User):
    prefs = db.query(UserPreferences).filter_by(user_id=user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=user.id); db.add(prefs)
    for k, v in PROFILE.items():
        setattr(prefs, k, v)
    db.flush()
    log.info(
        f"Profile set: allergies={PROFILE['allergies']}, "
        f"daily kcal={PROFILE['daily_limits']['calories']}, "
        f"sugar cap={PROFILE['daily_limits']['sugar_g']}g, "
        f"sodium cap={PROFILE['daily_limits']['sodium_mg']}mg"
    )


def reseed_30d_meal_logs(db, user: User):
    deleted = db.query(MealLog).filter_by(user_id=user.id).delete()
    if deleted:
        log.info(f"Cleared {deleted} existing meal logs")

    rng = random.Random(7)  # deterministic seed
    now = datetime.now(timezone.utc)
    inserted = 0
    daily_caloric_intake: list[int] = []

    # 29 days ago → yesterday
    for days_ago in range(30, 0, -1):
        day_base = now - timedelta(days=days_ago)
        day_total_kcal = 0

        # Ensure breakfast/lunch/dinner every day, snacks 60% of days
        slots = ["breakfast", "lunch", "dinner"]
        if rng.random() < 0.6:
            slots.insert(2, "snack")

        # On a few days, intentionally push closer to limits to mirror real usage
        push_to_limit = (days_ago in (3, 9, 15, 23))

        for slot in slots:
            options = SAFE_MEAL_BANK[slot]
            if push_to_limit and slot in ("lunch", "dinner"):
                # Pick the highest-cal option to brush against the cap
                meal = max(options, key=lambda m: m[2])
            else:
                meal = rng.choice(options)
            mname, kcal, p, c, f, s, sodium = meal
            hour = {"breakfast": 8, "lunch": 13, "snack": 16, "dinner": 19}[slot]
            eaten_at = day_base.replace(hour=hour, minute=rng.randint(0, 30), second=0, microsecond=0)
            db.add(MealLog(
                user_id=user.id, meal_name=mname, meal_type=slot,
                calories=kcal, protein_g=p, carbs_g=c, fat_g=f, sugar_g=s,
                eaten_at=eaten_at, source="manual",
                extra={"sodium_mg": sodium},
            ))
            day_total_kcal += kcal
            inserted += 1
        daily_caloric_intake.append(day_total_kcal)

    # TODAY: only breakfast logged so the agents see real remaining budget
    today_breakfast = SAFE_MEAL_BANK["breakfast"][0]
    today_at = now.replace(hour=8, minute=10, second=0, microsecond=0)
    db.add(MealLog(
        user_id=user.id,
        meal_name=today_breakfast[0], meal_type="breakfast",
        calories=today_breakfast[1], protein_g=today_breakfast[2], carbs_g=today_breakfast[3],
        fat_g=today_breakfast[4], sugar_g=today_breakfast[5],
        eaten_at=today_at, source="manual",
        extra={"sodium_mg": today_breakfast[6]},
    ))
    inserted += 1

    db.flush()
    avg = sum(daily_caloric_intake) / len(daily_caloric_intake) if daily_caloric_intake else 0
    log.info(
        f"Seeded {inserted} meal logs across 30 days + today's breakfast. "
        f"Avg daily intake: {avg:.0f} kcal · min {min(daily_caloric_intake)} · max {max(daily_caloric_intake)}"
    )


def reseed_recommendation_history(db, user: User):
    deleted = db.query(RecommendationRequest).filter_by(user_id=user.id).delete()
    if deleted:
        log.info(f"Cleared {deleted} existing recommendation requests")

    samples = [
        ("Lunch idea that keeps my carbs under 50g", False,
         {"meal_name": "Grilled salmon salad with mixed greens", "calories": 510, "protein": 34, "carbs": 18}),
        ("Diabetes-friendly snack between lunch and dinner", False,
         {"meal_name": "Greek yogurt with cinnamon", "calories": 130, "protein": 15, "carbs": 8}),
        ("Photo of my plate — is this safe?", True,
         {"meal_name": "Quinoa bowl with grilled chicken & spinach", "decision": "can_eat",
          "verdict_reason": "Naturally gluten-free, contains no nuts, sugar 4 g — well within today's cap."}),
        ("Low-sodium dinner under 600 kcal", False,
         {"meal_name": "Pan-seared cod with roasted vegetables", "calories": 470, "protein": 36, "carbs": 24}),
        ("Photo: friend brought me homemade muffins", True,
         {"meal_name": "Steel-cut oats with blueberries (alternative)", "decision": "cannot_eat",
          "verdict_reason": "Conventional muffins contain wheat (gluten) — unsafe given your celiac. Try this instead."}),
        ("Breakfast with steady blood sugar", False,
         {"meal_name": "Veggie omelette with tomato & feta", "calories": 340, "protein": 24, "carbs": 8}),
        ("Quick protein for after my walk", False,
         {"meal_name": "Hard-boiled egg & cherry tomatoes", "calories": 110, "protein": 9, "carbs": 4}),
        ("Photo of restaurant meal — chicken with sauce", True,
         {"meal_name": "Roasted chicken breast with quinoa pilaf", "decision": "try_alternative",
          "verdict_reason": "The sauce likely contains wheat flour and is high in sodium. Try this homemade alternative."}),
        ("Higher-protein dinner without exceeding sodium", False,
         {"meal_name": "Grilled salmon, quinoa & steamed asparagus", "calories": 580, "protein": 42, "carbs": 42}),
        ("Healthy way to use leftover roasted chicken", False,
         {"meal_name": "Chicken & quinoa salad bowl", "calories": 490, "protein": 38, "carbs": 38}),
    ]

    base = datetime.now(timezone.utc) - timedelta(days=12)
    for i, (msg, has_photo, snap) in enumerate(samples):
        created = base + timedelta(days=i, hours=11)
        completed = created + timedelta(seconds=14)
        ctx_override = {"photo_data_url": "data:image/jpeg;base64,(omitted)", "photo_filename": "meal.jpg"} if has_photo else None
        req = RecommendationRequest(
            user_id=user.id, message=msg, context_override=ctx_override,
            sensitive_mode=False, status=RequestStatus.COMPLETED,
            created_at=created, completed_at=completed,
        )
        db.add(req); db.flush()
        agent3_output = {
            "decision": snap.get("decision", "try_alternative"),
            "verdict_reason": snap.get("verdict_reason", "Fits today's plan."),
            "validation_result": "approved",
            "final_recommendation": {
                "meal_name": snap.get("meal_name"),
                "description": "Seeded historical recommendation.",
                "ingredients": [],
                "nutrition": {
                    "calories": snap.get("calories", 500),
                    "protein": snap.get("protein", 25),
                    "carbs": snap.get("carbs", 40),
                    "fat": 16, "sugar": 5,
                },
                "preparation": "—",
                "prep_time_minutes": 25,
                "tags": ["Gluten-Free", "Diabetic-Friendly"],
            },
            "changes_made": [],
            "confidence_score": 0.92,
        }
        db.add(AgentOutput(request_id=req.id, agent_number=1, output={"intent": "seed"}, latency_ms=120))
        db.add(AgentOutput(request_id=req.id, agent_number=2, output=agent3_output["final_recommendation"], latency_ms=900))
        db.add(AgentOutput(request_id=req.id, agent_number=3, output=agent3_output, latency_ms=600))
    db.flush()
    log.info(f"Seeded {len(samples)} recommendation requests")


def main():
    db = SessionLocal()
    try:
        user = upsert_user(db)
        upsert_preferences(db, user)
        reseed_30d_meal_logs(db, user)
        reseed_recommendation_history(db, user)
        db.commit()
        log.info(f"✅ Seed complete for {EMAIL} (id={user.id})  password: {PASSWORD}")
    except Exception:
        db.rollback()
        log.exception("Seed FAILED — rolled back")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
