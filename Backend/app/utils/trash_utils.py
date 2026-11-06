"""Logika Sampah (Trash): pindah ke sampah, pulihkan, hapus permanen, dan pembersihan otomatis."""
import logging
import math
import shutil
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import TrashItem
from app.schemas import TrashItemOut
from app.utils.file_utils import (
    format_bytes,
    get_directory_stats,
    get_trash_root,
    guess_media_type,
    resolve_safe_path,
    unique_path,
)

logger = logging.getLogger("cloud-storage")

ORPHAN_MIN_AGE_SECONDS = 3600  # folder sampah tanpa catatan baru dibersihkan jika lebih tua dari ini


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    """SQLite mengembalikan datetime tanpa tzinfo; semua waktu kita simpan dalam UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def expires_at(item: TrashItem) -> datetime:
    return as_utc(item.deleted_at) + timedelta(days=settings.TRASH_RETENTION_DAYS)


def container_path(item: TrashItem) -> Path:
    return get_trash_root() / item.id


def to_out(item: TrashItem) -> TrashItemOut:
    expiry = expires_at(item)
    seconds_left = (expiry - _utcnow()).total_seconds()
    original = item.original_path
    return TrashItemOut(
        id=item.id,
        name=item.name,
        original_path=original,
        parent_path=original.rsplit("/", 1)[0] if "/" in original else "",
        is_dir=item.is_dir,
        size=item.size,
        size_human="-" if item.is_dir and item.size == 0 else format_bytes(item.size),
        extension="" if item.is_dir else Path(item.name).suffix.lower().lstrip("."),
        mime_type=None if item.is_dir else guess_media_type(item.name),
        deleted_at=as_utc(item.deleted_at),
        expires_at=expiry,
        days_left=max(math.ceil(seconds_left / 86400), 0),
        deleted_by=item.deleted_by,
    )


def move_to_trash(db: Session, target: Path, username: Optional[str]) -> TrashItem:
    """Pindahkan file/folder ke <storage>/.trash/<id>/<nama> (operasi rename, cepat) dan catat di database."""
    root = settings.storage_root
    if target == root or not target.is_relative_to(root):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Item ini tidak dapat dipindahkan ke Sampah")

    is_dir = target.is_dir()
    size = get_directory_stats(target)[0] if is_dir else target.stat().st_size
    original_path = target.relative_to(root).as_posix()

    item_id = uuid.uuid4().hex
    container = get_trash_root() / item_id
    destination = container / target.name
    try:
        container.mkdir(parents=True, exist_ok=False)
        shutil.move(str(target), str(destination))
    except OSError as exc:
        shutil.rmtree(container, ignore_errors=True)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Gagal memindahkan ke Sampah: {exc.strerror or exc}")

    item = TrashItem(
        id=item_id,
        name=target.name,
        original_path=original_path,
        is_dir=is_dir,
        size=size,
        deleted_by=username,
    )
    try:
        db.add(item)
        db.commit()
    except Exception:
        db.rollback()
        try:  # kembalikan file ke tempat semula agar tidak "hilang"
            shutil.move(str(destination), str(target))
            shutil.rmtree(container, ignore_errors=True)
        except OSError:
            logger.exception("Gagal mengembalikan item setelah error database: %s", original_path)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Gagal mencatat item Sampah")
    db.refresh(item)
    return item


def restore_item(db: Session, item: TrashItem) -> str:
    """Pulihkan ke lokasi asal (folder induk dibuat ulang jika perlu). Mengembalikan path relatif hasil pemulihan."""
    container = container_path(item)
    source = container / item.name
    if not source.exists():
        db.delete(item)
        db.commit()
        shutil.rmtree(container, ignore_errors=True)
        raise HTTPException(status.HTTP_410_GONE, "File sudah tidak ada di Sampah")

    root = settings.storage_root
    target = resolve_safe_path(item.original_path)
    parent = target.parent
    try:
        parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        parent = root  # lokasi asal tidak bisa dibuat ulang -> pulihkan ke root
    final_path = unique_path(parent, item.name)

    try:
        shutil.move(str(source), str(final_path))
    except OSError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Gagal memulihkan: {exc.strerror or exc}")

    shutil.rmtree(container, ignore_errors=True)
    db.delete(item)
    db.commit()
    return final_path.relative_to(root).as_posix()


def delete_permanently(db: Session, item: TrashItem) -> None:
    container = container_path(item)
    shutil.rmtree(container, ignore_errors=True)
    if container.exists():
        logger.warning("Sebagian isi Sampah tidak dapat dihapus: %s", container)
    db.delete(item)
    db.commit()


def empty_trash(db: Session) -> int:
    items = db.scalars(select(TrashItem)).all()
    for item in items:
        delete_permanently(db, item)
    return len(items)


def purge_expired(db: Session) -> int:
    """Hapus permanen item yang melewati masa simpan, dan bersihkan folder yatim di .trash."""
    now = _utcnow()
    removed = 0
    items = db.scalars(select(TrashItem)).all()
    known_ids = set()
    for item in items:
        if expires_at(item) <= now:
            delete_permanently(db, item)
            removed += 1
        else:
            known_ids.add(item.id)

    trash_root = get_trash_root()
    if trash_root.is_dir():
        for child in trash_root.iterdir():
            if child.name in known_ids or not child.is_dir():
                continue
            try:
                age = time.time() - child.stat().st_mtime
            except OSError:
                continue
            if age > ORPHAN_MIN_AGE_SECONDS:
                shutil.rmtree(child, ignore_errors=True)
    return removed
