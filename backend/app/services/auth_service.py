"""Auth service — signup, login, token management."""

import logging
from sqlalchemy.orm import Session

from app.models.user import User, UserPreferences
from app.utils.security import hash_password, verify_password, create_access_token

logger = logging.getLogger(__name__)


class AuthError(Exception):
    pass


def signup(db: Session, email: str, password: str) -> tuple[User, str]:
    """Create new user account. Returns (user, token)."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise AuthError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
    )
    db.add(user)
    db.flush()

    # Create empty preferences
    prefs = UserPreferences(user_id=user.id)
    db.add(prefs)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    logger.info(f"User signed up: {email}")
    return user, token


def login(db: Session, email: str, password: str) -> tuple[User, str]:
    """Authenticate user. Returns (user, token)."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise AuthError("Invalid email or password")

    if not verify_password(password, user.password_hash):
        raise AuthError("Invalid email or password")

    token = create_access_token(str(user.id))
    logger.info(f"User logged in: {email}")
    return user, token
