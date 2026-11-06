"""Helper file: pencegah Path Traversal, format ukuran, cek kapasitas disk, kategori & tipe media."""
import mimetypes
import os
import re
import shutil
import stat
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

from fastapi import HTTPException, status

from app.config import settings
from app.schemas import FileItem

# File sementara saat upload (disembunyikan dari listing)
PARTIAL_SUFFIX = ".upload.part"
# Folder sistem untuk Sampah (disembunyikan & tidak bisa diakses lewat path biasa)
TRASH_DIR_NAME = ".trash"

_INVALID_NAME_CHARS = re.compile(r'[\x00-\x1f<>:"/\\|?*]')
_WINDOWS_DRIVE = re.compile(r"^[A-Za-z]:")
MAX_NAME_LENGTH = 255

# Registry Windows kadang tidak punya/keliru untuk tipe media -> jangan bergantung pada mimetypes saja
MEDIA_TYPE_OVERRIDES = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".ogv": "video/ogg",
    ".wmv": "video/x-ms-wmv",
    ".3gp": "video/3gpp",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".opus": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/plain",
    ".log": "text/plain",
}

CATEGORY_EXTENSIONS = {
    "documents": {
        "pdf", "doc", "docx", "odt", "rtf", "txt", "md", "xls", "xlsx", "csv", "ods",
        "ppt", "pptx", "odp", "epub",
    },
    "photos": {
        "jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "avif", "heic", "heif",
        "tiff", "tif", "raw", "cr2", "nef", "dng",
    },
    "videos": {"mp4", "mkv", "avi", "mov", "webm", "flv", "wmv", "m4v", "mpg", "mpeg", "3gp", "ogv"},
    "music": {"mp3", "wav", "flac", "ogg", "m4a", "aac", "wma", "opus", "oga"},
    "archives": {"zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "tgz"},
}


# ----------------------------------------------------------------------------
# Path safety
# ----------------------------------------------------------------------------
def normalize_relative_path(user_path: Optional[str]) -> str:
    """
    Normalisasi input path dari user menjadi path relatif bergaya POSIX.
    - '/', '' dan '.' berarti root storage.
    - Awalan '/' dianggap relatif terhadap root storage (BUKAN root OS).
    - Segmen '..', byte null, dan drive letter Windows ditolak.
    - Folder sistem '.trash' (Sampah) tidak bisa diakses lewat path biasa.
    """
    if user_path is None:
        return ""
    if "\x00" in user_path:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Path mengandung karakter tidak valid")

    parts = []
    for part in user_path.replace("\\", "/").split("/"):
        part = part.strip()
        if part in ("", "."):
            continue
        if part == "..":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Path tidak valid: '..' tidak diizinkan")
        if _WINDOWS_DRIVE.match(part) or (os.name == "nt" and ":" in part):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Path tidak valid: drive/absolute path tidak diizinkan")
        parts.append(part)

    if parts and parts[0].lower() == TRASH_DIR_NAME:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Folder sistem tidak dapat diakses")
    return "/".join(parts)


def resolve_safe_path(user_path: Optional[str]) -> Path:
    """
    Ubah path dari user menjadi path absolut yang DIJAMIN berada di dalam root storage.
    Lapisan 1: tolak '..' dan absolute/drive path.
    Lapisan 2: resolve() (mengikuti symlink) lalu pastikan masih di dalam root.
    """
    root = settings.storage_root
    relative = normalize_relative_path(user_path)
    candidate = (root / relative).resolve() if relative else root
    if candidate != root and not candidate.is_relative_to(root):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Akses ditolak: path berada di luar folder storage")
    return candidate


def to_relative_path(path: Path) -> str:
    """Path absolut di dalam storage -> string relatif ('' untuk root)."""
    root = settings.storage_root
    if path == root:
        return ""
    return path.relative_to(root).as_posix()


def get_trash_root() -> Path:
    return settings.storage_root / TRASH_DIR_NAME


def validate_name(name: str) -> str:
    """Validasi ketat nama file/folder (untuk create-folder & rename)."""
    name = (name or "").strip()
    if not name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nama tidak boleh kosong")
    if len(name) > MAX_NAME_LENGTH:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Nama maksimal {MAX_NAME_LENGTH} karakter")
    if name in (".", "..") or name.endswith("."):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nama tidak valid")
    if _INVALID_NAME_CHARS.search(name):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            'Nama tidak boleh mengandung karakter: / \\ : * ? " < > | atau karakter kontrol',
        )
    if name.endswith(PARTIAL_SUFFIX):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nama menggunakan akhiran yang dicadangkan sistem")
    return name


def sanitize_filename(filename: Optional[str]) -> str:
    """Bersihkan nama file hasil upload (tidak menolak, tapi mengganti karakter berbahaya)."""
    name = (filename or "").replace("\\", "/").split("/")[-1]
    name = _INVALID_NAME_CHARS.sub("_", name).strip().rstrip(". ")
    if name in ("", ".", ".."):
        name = "unnamed"
    if name.endswith(PARTIAL_SUFFIX):
        name = name + "_"
    if name.lower() == TRASH_DIR_NAME:
        name = "_" + name
    if len(name) > MAX_NAME_LENGTH:
        stem, suffix = os.path.splitext(name)
        name = stem[: MAX_NAME_LENGTH - len(suffix)] + suffix
    return name


def unique_path(directory: Path, filename: str) -> Path:
    """Jika file sudah ada, hasilkan 'nama (1).ext', 'nama (2).ext', dst."""
    candidate = directory / filename
    if not candidate.exists():
        return candidate
    stem, suffix = os.path.splitext(filename)
    for i in range(1, 10000):
        candidate = directory / f"{stem} ({i}){suffix}"
        if not candidate.exists():
            return candidate
    raise HTTPException(status.HTTP_409_CONFLICT, "Tidak dapat membuat nama file unik")


def unique_copy_path(directory: Path, name: str, is_dir: bool) -> Path:
    """Nama untuk salinan: 'nama.ext' -> 'nama (salinan).ext' -> 'nama (salinan 2).ext'."""
    candidate = directory / name
    if not candidate.exists():
        return candidate
    stem, suffix = (name, "") if is_dir else os.path.splitext(name)
    candidate = directory / f"{stem} (salinan){suffix}"
    if not candidate.exists():
        return candidate
    for i in range(2, 10000):
        candidate = directory / f"{stem} (salinan {i}){suffix}"
        if not candidate.exists():
            return candidate
    raise HTTPException(status.HTTP_409_CONFLICT, "Tidak dapat membuat nama salinan unik")


# ----------------------------------------------------------------------------
# Formatting, tipe media & kategori
# ----------------------------------------------------------------------------
def format_bytes(size: float) -> str:
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{int(value)} {unit}" if unit == "B" else f"{value:.2f} {unit}"
        value /= 1024
    return f"{value:.2f} PB"


def guess_media_type(filename: str) -> Optional[str]:
    ext = os.path.splitext(filename)[1].lower()
    return MEDIA_TYPE_OVERRIDES.get(ext) or mimetypes.guess_type(filename)[0]


def get_category(extension: str) -> str:
    ext = (extension or "").lower().lstrip(".")
    for category, extensions in CATEGORY_EXTENSIONS.items():
        if ext in extensions:
            return category
    return "other"


def build_file_item(path: Path, st: Optional[os.stat_result] = None) -> FileItem:
    st = st or path.stat()
    is_dir = stat.S_ISDIR(st.st_mode)
    size = 0 if is_dir else st.st_size
    return FileItem(
        name=path.name,
        path=to_relative_path(path),
        is_dir=is_dir,
        size=size,
        size_human="-" if is_dir else format_bytes(size),
        modified=datetime.fromtimestamp(st.st_mtime, tz=timezone.utc),
        extension="" if is_dir else path.suffix.lower().lstrip("."),
        mime_type=None if is_dir else guess_media_type(path.name),
    )


# ----------------------------------------------------------------------------
# Disk
# ----------------------------------------------------------------------------
def get_disk_usage() -> Tuple[int, int, int]:
    """(total, used, free) dalam byte untuk disk/partisi tempat storage berada."""
    usage = shutil.disk_usage(settings.storage_root)
    return usage.total, usage.used, usage.free


def check_free_space(required_bytes: int) -> None:
    """Tolak operasi jika ruang bebas (dikurangi cadangan minimum) tidak cukup."""
    _, _, free = get_disk_usage()
    reserve = settings.MIN_FREE_SPACE_MB * 1024 * 1024
    if required_bytes + reserve > free:
        raise HTTPException(
            status_code=507,
            detail=f"Ruang penyimpanan tidak cukup (bebas: {format_bytes(free)}, dibutuhkan: {format_bytes(required_bytes)})",
        )


def get_directory_stats(path: Path, skip_top_level: Tuple[str, ...] = ()) -> Tuple[int, int, int]:
    """
    (total_size_bytes, jumlah_file, jumlah_folder) secara rekursif. Symlink diabaikan.
    skip_top_level: nama entri tingkat atas yang dilewati (mis. '.trash').
    """
    skip = {name.lower() for name in skip_top_level}
    total_size = files = folders = 0
    stack = [path]
    while stack:
        current = stack.pop()
        is_top = current == path
        try:
            with os.scandir(current) as it:
                for entry in it:
                    try:
                        if entry.is_symlink():
                            continue
                        if entry.is_dir(follow_symlinks=False):
                            if is_top and entry.name.lower() in skip:
                                continue
                            folders += 1
                            stack.append(Path(entry.path))
                        elif entry.is_file(follow_symlinks=False):
                            if entry.name.endswith(PARTIAL_SUFFIX):
                                continue
                            files += 1
                            total_size += entry.stat(follow_symlinks=False).st_size
                    except OSError:
                        continue
        except OSError:
            continue
    return total_size, files, folders


def scan_category(category: str, needle: Optional[str] = None) -> List[Tuple[Path, os.stat_result]]:
    """Cari semua file (rekursif) pada kategori tertentu. Folder Sampah & symlink dilewati."""
    root = settings.storage_root
    results: List[Tuple[Path, os.stat_result]] = []
    stack = [root]
    while stack:
        current = stack.pop()
        is_root = current == root
        try:
            with os.scandir(current) as it:
                for entry in it:
                    try:
                        if entry.is_symlink():
                            continue
                        if entry.is_dir(follow_symlinks=False):
                            if is_root and entry.name.lower() == TRASH_DIR_NAME:
                                continue
                            stack.append(Path(entry.path))
                            continue
                        if not entry.is_file(follow_symlinks=False) or entry.name.endswith(PARTIAL_SUFFIX):
                            continue
                        extension = os.path.splitext(entry.name)[1]
                        if get_category(extension) != category:
                            continue
                        if needle and needle not in entry.name.lower():
                            continue
                        results.append((Path(entry.path), entry.stat(follow_symlinks=False)))
                    except OSError:
                        continue
        except OSError:
            continue
    return results
