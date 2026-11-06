"""Endpoint manajemen file: list, kategori, upload, download/stream, create-folder, delete (ke Sampah), rename/move, copy."""
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import AsyncIterator, List, Literal, Optional, Tuple
from urllib.parse import quote

import aiofiles
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user, get_current_user_media
from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import (
    CategoryListResponse,
    CopyRequest,
    CreateFolderRequest,
    FileItem,
    FileListResponse,
    MessageResponse,
    RenameRequest,
    UploadResponse,
    UploadResult,
)
from app.utils.file_utils import (
    PARTIAL_SUFFIX,
    TRASH_DIR_NAME,
    build_file_item,
    check_free_space,
    format_bytes,
    get_directory_stats,
    guess_media_type,
    normalize_relative_path,
    resolve_safe_path,
    sanitize_filename,
    scan_category,
    to_relative_path,
    unique_copy_path,
    unique_path,
    validate_name,
)
from app.utils.trash_utils import move_to_trash

router = APIRouter(prefix="/api/files", tags=["Files"])

# Tipe yang berisiko menjalankan script jika dibuka inline di browser -> dipaksa 'attachment'
_FORCE_DOWNLOAD_TYPES = {
    "text/html",
    "application/xhtml+xml",
    "image/svg+xml",
    "text/xml",
    "application/xml",
    "text/javascript",
    "application/javascript",
}

CategoryName = Literal["documents", "photos", "videos", "music", "archives", "other"]


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _require_directory(path: Path) -> None:
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Direktori tidak ditemukan")
    if not path.is_dir():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Path bukan sebuah direktori")


def _require_exists(path: Path) -> None:
    if not path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File atau folder tidak ditemukan")


def _item_sort_key(sort_by: str):
    if sort_by == "size":
        return lambda item: item.size
    if sort_by == "modified":
        return lambda item: item.modified
    if sort_by == "type":
        return lambda item: (item.extension, item.name.lower())
    return lambda item: item.name.lower()


def _raw_sort_key(sort_by: str):
    """Kunci urut untuk tuple (Path, stat_result) pada pencarian kategori."""
    if sort_by == "size":
        return lambda pair: pair[1].st_size
    if sort_by == "modified":
        return lambda pair: pair[1].st_mtime
    if sort_by == "type":
        return lambda pair: (pair[0].suffix.lower(), pair[0].name.lower())
    return lambda pair: pair[0].name.lower()


def _parse_range(header: str, size: int) -> Optional[Tuple[int, int]]:
    """
    Parse header Range (satu rentang). Mengembalikan (start, end) inklusif,
    None jika header harus diabaikan (kirim file penuh), atau raise 416 jika tidak terpenuhi.
    """
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", header.strip())
    if not match:
        return None  # format tidak didukung / multi-range -> layani penuh
    start_s, end_s = match.groups()
    if not start_s and not end_s:
        return None

    unsatisfiable = HTTPException(
        status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
        detail="Range tidak dapat dipenuhi",
        headers={"Content-Range": f"bytes */{size}"},
    )

    if not start_s:  # suffix: bytes=-500
        length = int(end_s)
        if length == 0:
            raise unsatisfiable
        return max(size - length, 0), size - 1

    start = int(start_s)
    if start >= size:
        raise unsatisfiable
    end = int(end_s) if end_s else size - 1
    if end < start:
        return None
    return start, min(end, size - 1)


async def _iter_file(path: Path, start: int, end: int) -> AsyncIterator[bytes]:
    remaining = end - start + 1
    chunk_size = settings.DOWNLOAD_CHUNK_SIZE
    async with aiofiles.open(path, "rb") as f:
        await f.seek(start)
        while remaining > 0:
            data = await f.read(min(chunk_size, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def _content_disposition(disposition: str, filename: str) -> str:
    ascii_fallback = filename.encode("ascii", "ignore").decode().replace('"', "").replace("\\", "") or "download"
    return f"{disposition}; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quote(filename)}"


async def _save_upload(upload: UploadFile, target_dir: Path, overwrite: bool) -> UploadResult:
    original_name = upload.filename or ""
    safe_name = sanitize_filename(original_name)
    tmp_path = target_dir / f".{uuid.uuid4().hex}{PARTIAL_SUFFIX}"
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    written = 0

    try:
        if overwrite:
            final_path = target_dir / safe_name
            if final_path.is_dir():
                raise HTTPException(status.HTTP_409_CONFLICT, "Sudah ada folder dengan nama yang sama")
        else:
            final_path = unique_path(target_dir, safe_name)

        if upload.size is not None:
            if max_bytes and upload.size > max_bytes:
                raise HTTPException(
                    status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    f"Ukuran file melebihi batas {settings.MAX_UPLOAD_SIZE_MB} MB",
                )
            check_free_space(upload.size)

        async with aiofiles.open(tmp_path, "wb") as out:
            while True:
                chunk = await upload.read(settings.UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                written += len(chunk)
                if max_bytes and written > max_bytes:
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        f"Ukuran file melebihi batas {settings.MAX_UPLOAD_SIZE_MB} MB",
                    )
                await out.write(chunk)

        os.replace(tmp_path, final_path)  # atomic: file muncul utuh atau tidak sama sekali
        return UploadResult(
            filename=original_name,
            success=True,
            saved_as=final_path.name,
            path=to_relative_path(final_path),
            size=written,
        )
    except HTTPException as exc:
        return UploadResult(filename=original_name, success=False, error=str(exc.detail))
    except OSError as exc:
        return UploadResult(filename=original_name, success=False, error=f"Gagal menulis file: {exc.strerror or exc}")
    finally:
        await upload.close()
        try:
            if tmp_path.exists():
                tmp_path.unlink()
        except OSError:
            pass


# ----------------------------------------------------------------------------
# Endpoints
# ----------------------------------------------------------------------------
@router.get("", response_model=FileListResponse)
def list_files(
    path: str = Query("", description="Direktori yang dibaca (relatif terhadap root). Kosong = root"),
    sort_by: Literal["name", "size", "modified", "type"] = Query("name"),
    order: Literal["asc", "desc"] = Query("asc"),
    search: Optional[str] = Query(None, description="Filter nama (mengandung teks, case-insensitive)"),
    current_user: User = Depends(get_current_user),
):
    """Daftar file & folder dalam sebuah direktori (folder selalu tampil lebih dulu)."""
    target = resolve_safe_path(path)
    _require_directory(target)
    is_root = target == settings.storage_root

    needle = search.lower().strip() if search else None
    items: List[FileItem] = []
    try:
        with os.scandir(target) as entries:
            for entry in entries:
                if entry.is_symlink() or entry.name.endswith(PARTIAL_SUFFIX):
                    continue
                if is_root and entry.name.lower() == TRASH_DIR_NAME:
                    continue
                if needle and needle not in entry.name.lower():
                    continue
                try:
                    items.append(build_file_item(Path(entry.path), entry.stat(follow_symlinks=False)))
                except OSError:
                    continue
    except PermissionError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tidak ada izin membaca direktori ini")

    reverse = order == "desc"
    key = _item_sort_key(sort_by)
    folders = sorted((i for i in items if i.is_dir), key=key, reverse=reverse)
    files = sorted((i for i in items if not i.is_dir), key=key, reverse=reverse)

    relative = to_relative_path(target)
    parent = None if relative == "" else "/".join(relative.split("/")[:-1])

    return FileListResponse(
        path=relative,
        parent=parent,
        total_items=len(items),
        total_folders=len(folders),
        total_files=len(files),
        items=folders + files,
    )


@router.get("/category/{category}", response_model=CategoryListResponse)
def list_category(
    category: CategoryName,
    sort_by: Literal["name", "size", "modified", "type"] = Query("modified"),
    order: Literal["asc", "desc"] = Query("desc"),
    search: Optional[str] = Query(None, description="Filter nama (case-insensitive)"),
    limit: int = Query(1000, ge=1, le=5000, description="Jumlah maksimum item yang dikembalikan"),
    current_user: User = Depends(get_current_user),
):
    """Semua file pada satu kategori (dokumen, foto, video, musik, arsip, lainnya) dari seluruh folder."""
    needle = search.lower().strip() if search else None
    matches = scan_category(category, needle)
    matches.sort(key=_raw_sort_key(sort_by), reverse=(order == "desc"))

    total_size = sum(st.st_size for _, st in matches)
    items = [build_file_item(path, st) for path, st in matches[:limit]]

    return CategoryListResponse(
        category=category,
        total=len(matches),
        total_size=total_size,
        total_size_human=format_bytes(total_size),
        truncated=len(matches) > limit,
        items=items,
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_files(
    response: Response,
    files: List[UploadFile] = File(..., description="Satu atau banyak file"),
    path: str = Form("", description="Direktori tujuan (relatif terhadap root). Kosong = root"),
    overwrite: bool = Form(False, description="true = timpa file bernama sama; false = beri nama unik 'nama (1).ext'"),
    current_user: User = Depends(get_current_user),
):
    """Upload file tunggal/banyak. File ditulis per-chunk ke file sementara lalu dipindah secara atomic."""
    target_dir = resolve_safe_path(path)
    _require_directory(target_dir)

    results: List[UploadResult] = []
    for upload in files:
        results.append(await _save_upload(upload, target_dir, overwrite))

    succeeded = sum(1 for r in results if r.success)
    failed = len(results) - succeeded
    response.status_code = status.HTTP_201_CREATED if succeeded else status.HTTP_400_BAD_REQUEST
    return UploadResponse(total=len(results), succeeded=succeeded, failed=failed, results=results)


@router.get("/download")
async def download_file(
    request: Request,
    path: str = Query(..., min_length=1, description="Path file"),
    inline: bool = Query(False, description="true = tampilkan di browser/player (streaming media)"),
    current_user: User = Depends(get_current_user_media),
):
    """Unduh file atau stream media dengan dukungan HTTP Range (seek video/audio)."""
    file_path = resolve_safe_path(path)
    _require_exists(file_path)
    if file_path.is_dir():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Path adalah folder, bukan file")

    file_size = file_path.stat().st_size
    media_type = guess_media_type(file_path.name) or "application/octet-stream"
    disposition = "inline" if inline and media_type not in _FORCE_DOWNLOAD_TYPES else "attachment"

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": _content_disposition(disposition, file_path.name),
        # Media inline boleh di-cache sebentar (URL stabil selama token sama) agar thumbnail tidak diunduh ulang terus
        "Cache-Control": "private, max-age=60" if inline else "private, max-age=0, must-revalidate",
    }

    if file_size == 0:
        headers["Content-Length"] = "0"
        return Response(content=b"", media_type=media_type, headers=headers)

    start, end = 0, file_size - 1
    status_code = status.HTTP_200_OK
    range_header = request.headers.get("range")
    if range_header:
        parsed = _parse_range(range_header, file_size)
        if parsed is not None:
            start, end = parsed
            status_code = status.HTTP_206_PARTIAL_CONTENT
            headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"

    headers["Content-Length"] = str(end - start + 1)
    return StreamingResponse(
        _iter_file(file_path, start, end),
        status_code=status_code,
        media_type=media_type,
        headers=headers,
    )


@router.post("/create-folder", response_model=FileItem, status_code=status.HTTP_201_CREATED)
def create_folder(payload: CreateFolderRequest, current_user: User = Depends(get_current_user)):
    """Buat folder baru di direktori target."""
    parent_rel = normalize_relative_path(payload.path)
    parent = resolve_safe_path(parent_rel)
    _require_directory(parent)

    name = validate_name(payload.name)
    new_dir = resolve_safe_path(f"{parent_rel}/{name}")
    if new_dir.exists():
        raise HTTPException(status.HTTP_409_CONFLICT, "File atau folder dengan nama tersebut sudah ada")

    try:
        new_dir.mkdir()
    except OSError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Gagal membuat folder: {exc.strerror or exc}")
    return build_file_item(new_dir)


@router.delete("", response_model=MessageResponse)
def delete_item(
    path: str = Query(..., min_length=1, description="Path file/folder yang dihapus"),
    permanent: bool = Query(False, description="true = hapus permanen (lewati Sampah)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pindahkan file/folder ke Sampah (default), atau hapus permanen dengan permanent=true."""
    relative = normalize_relative_path(path)
    if relative == "":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Root storage tidak boleh dihapus")

    target = resolve_safe_path(relative)
    _require_exists(target)

    if permanent:
        try:
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()
        except OSError as exc:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Gagal menghapus: {exc.strerror or exc}")
        return MessageResponse(message="Berhasil dihapus permanen", path=relative)

    item = move_to_trash(db, target, current_user.username)
    return MessageResponse(message="Dipindahkan ke Sampah", path=relative, trash_id=item.id)


@router.put("/rename", response_model=FileItem)
def rename_or_move(payload: RenameRequest, current_user: User = Depends(get_current_user)):
    """
    Rename dan/atau pindahkan item.
    - Rename : kirim `path` + `new_name`
    - Move   : kirim `path` + `destination` (folder tujuan)
    - Keduanya boleh digabung (pindah sekaligus ganti nama).
    """
    source_rel = normalize_relative_path(payload.path)
    if source_rel == "":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Root storage tidak boleh diubah")

    source = resolve_safe_path(source_rel)
    _require_exists(source)

    dest_dir = resolve_safe_path(payload.destination) if payload.destination is not None else source.parent
    _require_directory(dest_dir)

    new_name = validate_name(payload.new_name) if payload.new_name is not None else source.name
    dest = resolve_safe_path(f"{to_relative_path(dest_dir)}/{new_name}")

    if dest == source:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nama dan lokasi tujuan sama dengan sebelumnya")
    if source.is_dir() and (dest_dir == source or source in dest_dir.parents):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Folder tidak dapat dipindahkan ke dalam dirinya sendiri")
    if dest.exists() and not (dest.samefile(source)):  # samefile: izinkan ganti huruf besar/kecil
        raise HTTPException(status.HTTP_409_CONFLICT, "File atau folder dengan nama tersebut sudah ada di tujuan")

    try:
        shutil.move(str(source), str(dest))
    except OSError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Gagal mengubah/memindahkan: {exc.strerror or exc}")
    return build_file_item(dest)


@router.post("/copy", response_model=FileItem, status_code=status.HTTP_201_CREATED)
def copy_item(payload: CopyRequest, current_user: User = Depends(get_current_user)):
    """Salin file/folder ke direktori lain. Jika nama sudah ada, otomatis menjadi 'nama (salinan)'."""
    source_rel = normalize_relative_path(payload.path)
    if source_rel == "":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Root storage tidak dapat disalin")

    source = resolve_safe_path(source_rel)
    _require_exists(source)

    dest_dir = resolve_safe_path(payload.destination)
    _require_directory(dest_dir)

    is_dir = source.is_dir()
    if is_dir and (dest_dir == source or source in dest_dir.parents):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Folder tidak dapat disalin ke dalam dirinya sendiri")

    name = validate_name(payload.new_name) if payload.new_name else source.name
    dest = unique_copy_path(dest_dir, name, is_dir)
    # Pastikan hasil akhir tetap di dalam storage
    dest = resolve_safe_path(to_relative_path(dest_dir) + "/" + dest.name)

    required = get_directory_stats(source)[0] if is_dir else source.stat().st_size
    check_free_space(required)

    try:
        if is_dir:
            # Symlink di dalam folder diabaikan agar tidak menyalin isi dari luar storage
            shutil.copytree(
                source,
                dest,
                ignore=lambda directory, names: [n for n in names if os.path.islink(os.path.join(directory, n))],
            )
        else:
            shutil.copy2(source, dest)
    except OSError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Gagal menyalin: {exc.strerror or exc}")
    return build_file_item(dest)
