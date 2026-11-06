"""Endpoint informasi sistem."""
from fastapi import APIRouter, Depends, Query

from app.auth import get_current_user
from app.config import settings
from app.models import User
from app.schemas import HealthResponse, StorageInfo
from app.utils.file_utils import TRASH_DIR_NAME, format_bytes, get_directory_stats, get_disk_usage, get_trash_root

router = APIRouter(prefix="/api/system", tags=["System"])


@router.get("/health", response_model=HealthResponse)
def health():
    """Health check publik (tanpa autentikasi)."""
    return HealthResponse(status="ok", app=settings.APP_NAME, version=settings.APP_VERSION)


@router.get("/storage-info", response_model=StorageInfo)
def storage_info(
    include_folder_stats: bool = Query(True, description="Hitung ukuran isi folder storage (lebih lambat jika file sangat banyak)"),
    current_user: User = Depends(get_current_user),
):
    """Kapasitas total, terpakai, dan bebas dari disk tempat storage berada + ukuran isi storage & Sampah."""
    total, used, free = get_disk_usage()
    percent = round((used / total) * 100, 2) if total else 0.0

    trash_size = 0
    if include_folder_stats:
        folder_size, files, folders = get_directory_stats(settings.storage_root, skip_top_level=(TRASH_DIR_NAME,))
        trash_root = get_trash_root()
        if trash_root.is_dir():
            trash_size = get_directory_stats(trash_root)[0]
    else:
        folder_size = files = folders = 0

    return StorageInfo(
        total_bytes=total,
        used_bytes=used,
        free_bytes=free,
        percent_used=percent,
        total_human=format_bytes(total),
        used_human=format_bytes(used),
        free_human=format_bytes(free),
        storage_used_bytes=folder_size,
        storage_used_human=format_bytes(folder_size),
        total_files=files,
        total_folders=folders,
        trash_used_bytes=trash_size,
        trash_used_human=format_bytes(trash_size),
    )
