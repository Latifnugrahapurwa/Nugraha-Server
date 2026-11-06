"""Endpoint Sampah (Trash): daftar, pulihkan, hapus permanen, kosongkan."""
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import TrashItem, User
from app.schemas import MessageResponse, TrashItemOut, TrashListResponse
from app.utils.file_utils import format_bytes
from app.utils.trash_utils import delete_permanently, empty_trash, purge_expired, restore_item, to_out

router = APIRouter(prefix="/api/trash", tags=["Trash"])


def _get_item(db: Session, item_id: str) -> TrashItem:
    item = db.get(TrashItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item tidak ditemukan di Sampah")
    return item


@router.get("", response_model=TrashListResponse)
def list_trash(
    sort_by: Literal["deleted", "name", "size"] = Query("deleted"),
    order: Literal["asc", "desc"] = Query("desc"),
    search: Optional[str] = Query(None, description="Filter nama (case-insensitive)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Daftar item di Sampah. Item yang melewati masa simpan dibersihkan lebih dulu."""
    purge_expired(db)

    items: List[TrashItemOut] = [to_out(i) for i in db.scalars(select(TrashItem)).all()]
    needle = search.lower().strip() if search else None
    if needle:
        items = [i for i in items if needle in i.name.lower()]

    keys = {
        "deleted": lambda i: i.deleted_at,
        "name": lambda i: i.name.lower(),
        "size": lambda i: i.size,
    }
    items.sort(key=keys[sort_by], reverse=(order == "desc"))

    total_size = sum(i.size for i in items)
    return TrashListResponse(
        total=len(items),
        total_size=total_size,
        total_size_human=format_bytes(total_size),
        retention_days=settings.TRASH_RETENTION_DAYS,
        items=items,
    )


@router.post("/{item_id}/restore", response_model=MessageResponse)
def restore(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Pulihkan item ke lokasi asalnya."""
    item = _get_item(db, item_id)
    restored_path = restore_item(db, item)
    return MessageResponse(message="Berhasil dipulihkan", path=restored_path)


@router.delete("/{item_id}", response_model=MessageResponse)
def delete_forever(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Hapus satu item dari Sampah secara permanen."""
    item = _get_item(db, item_id)
    name = item.name
    delete_permanently(db, item)
    return MessageResponse(message=f'"{name}" dihapus permanen')


@router.delete("", response_model=MessageResponse)
def empty(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Kosongkan seluruh Sampah (permanen)."""
    count = empty_trash(db)
    return MessageResponse(message=f"Sampah dikosongkan ({count} item dihapus permanen)")
