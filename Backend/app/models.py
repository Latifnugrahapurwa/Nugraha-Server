"""Model SQLAlchemy."""
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class TrashItem(Base):
    """Catatan item yang dipindahkan ke Sampah. Fisiknya ada di <storage>/.trash/<id>/<nama>."""

    __tablename__ = "trash_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_path: Mapped[str] = mapped_column(String(4096), nullable=False)  # relatif terhadap root, termasuk nama
    is_dir: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)
    deleted_by: Mapped[str] = mapped_column(String(32), nullable=True)
