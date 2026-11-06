"""Endpoint autentikasi: register, login, me."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import authenticate_user, create_access_token, get_current_user, hash_password
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import Token, UserCreate, UserOut

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Registrasi. User PERTAMA otomatis menjadi admin.
    Setelah ada user, registrasi ditutup kecuali ALLOW_PUBLIC_REGISTRATION=true.
    """
    total_users = db.scalar(select(func.count(User.id))) or 0
    if total_users > 0 and not settings.ALLOW_PUBLIC_REGISTRATION:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Registrasi ditutup. Admin sudah terdaftar.")

    if db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username sudah digunakan")

    user = User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        is_admin=(total_users == 0),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Username sudah digunakan")
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login (form-data: username & password). Kompatibel dengan tombol Authorize di /docs."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {
        "access_token": create_access_token(user.username),
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user,
    }


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    """Cek status login & profil user saat ini."""
    return current_user
