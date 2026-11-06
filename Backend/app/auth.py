"""Hashing password, pembuatan/verifikasi JWT, dan dependency user aktif."""
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

password_hasher = PasswordHash((BcryptHasher(),))
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# Hash palsu untuk menyamakan waktu respon saat username tidak ditemukan (anti user-enumeration)
_DUMMY_HASH = password_hasher.hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return password_hasher.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": subject, "iat": now, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.scalar(select(User).where(User.username == username.strip().lower()))
    if user is None:
        verify_password(password, _DUMMY_HASH)
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau sudah kedaluwarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _resolve_user(token: Optional[str], db: Session) -> User:
    if not token:
        raise _credentials_exception()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        raise _credentials_exception()

    username = payload.get("sub")
    if not username or payload.get("type") != "access":
        raise _credentials_exception()

    user = db.scalar(select(User).where(User.username == username))
    if user is None or not user.is_active:
        raise _credentials_exception()
    return user


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Dependency standar: token dari header 'Authorization: Bearer <token>'."""
    return _resolve_user(token, db)


def get_current_user_media(
    header_token: Optional[str] = Depends(oauth2_scheme),
    query_token: Optional[str] = Query(None, alias="token", description="Alternatif header untuk tag <video>/<audio>/<img>"),
    db: Session = Depends(get_db),
) -> User:
    """Untuk endpoint download/stream: token boleh lewat header ATAU query string ?token=."""
    return _resolve_user(header_token or query_token, db)
