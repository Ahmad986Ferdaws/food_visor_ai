from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import SignupRequest, LoginRequest, AuthResponse, UserOut
from app.services.auth_service import signup, login, AuthError
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup_endpoint(body: SignupRequest, db: Session = Depends(get_db)):
    try:
        user, token = signup(db, body.email, body.password)
    except AuthError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    return AuthResponse(
        token=token,
        user=UserOut(id=str(user.id), email=user.email, email_verified=user.email_verified),
    )


@router.post("/login", response_model=AuthResponse)
def login_endpoint(body: LoginRequest, db: Session = Depends(get_db)):
    try:
        user, token = login(db, body.email, body.password)
    except AuthError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    return AuthResponse(
        token=token,
        user=UserOut(id=str(user.id), email=user.email, email_verified=user.email_verified),
    )


@router.get("/me", response_model=UserOut)
def me_endpoint(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=str(current_user.id),
        email=current_user.email,
        email_verified=current_user.email_verified,
    )
