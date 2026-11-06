"""Pydantic schemas untuk validasi request & response."""
import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")


# ----------------------------------------------------------------------------
# Auth
# ----------------------------------------------------------------------------
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=32, examples=["admin"])
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        value = value.strip().lower()
        if not USERNAME_PATTERN.match(value):
            raise ValueError("Username 3-32 karakter, hanya huruf, angka, titik, garis bawah, dan strip")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password maksimal 72 byte (batas algoritma bcrypt)")
        return value


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    is_admin: bool
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Masa berlaku token dalam detik")
    user: UserOut


# ----------------------------------------------------------------------------
# Files
# ----------------------------------------------------------------------------
class FileItem(BaseModel):
    name: str
    path: str = Field(..., description="Path relatif terhadap root storage (separator '/')")
    is_dir: bool
    size: int = Field(0, description="Ukuran dalam byte (0 untuk folder)")
    size_human: str
    modified: datetime
    extension: str = ""
    mime_type: Optional[str] = None


class FileListResponse(BaseModel):
    path: str
    parent: Optional[str] = None
    total_items: int
    total_folders: int
    total_files: int
    items: List[FileItem]


class UploadResult(BaseModel):
    filename: str
    success: bool
    saved_as: Optional[str] = None
    path: Optional[str] = None
    size: int = 0
    error: Optional[str] = None


class UploadResponse(BaseModel):
    total: int
    succeeded: int
    failed: int
    results: List[UploadResult]


class CreateFolderRequest(BaseModel):
    path: str = Field("", description="Direktori induk (relatif terhadap root). Kosong = root")
    name: str = Field(..., min_length=1, max_length=255, description="Nama folder baru")


class RenameRequest(BaseModel):
    path: str = Field(..., min_length=1, description="Path item yang diubah/dipindah")
    new_name: Optional[str] = Field(None, max_length=255, description="Nama baru (rename)")
    destination: Optional[str] = Field(
        None, description="Direktori tujuan (move). Kosong '' = root. Jika diisi bersama new_name: pindah + ganti nama"
    )

    @model_validator(mode="after")
    def require_one_action(self) -> "RenameRequest":
        if self.new_name is None and self.destination is None:
            raise ValueError("Isi 'new_name' (rename) dan/atau 'destination' (move)")
        return self


class MessageResponse(BaseModel):
    message: str
    path: Optional[str] = None
    trash_id: Optional[str] = Field(None, description="ID item di Sampah (untuk 'Urungkan')")


# ----------------------------------------------------------------------------
# System
# ----------------------------------------------------------------------------
class StorageInfo(BaseModel):
    total_bytes: int
    used_bytes: int
    free_bytes: int
    percent_used: float
    total_human: str
    used_human: str
    free_human: str
    storage_used_bytes: int = Field(..., description="Total ukuran isi folder storage")
    storage_used_human: str
    total_files: int
    total_folders: int
    trash_used_bytes: int = 0
    trash_used_human: str = "0 B"


class HealthResponse(BaseModel):
    status: str
    app: str
    version: str


# ----------------------------------------------------------------------------
# Copy, Category, Trash
# ----------------------------------------------------------------------------
class CopyRequest(BaseModel):
    path: str = Field(..., min_length=1, description="Path item yang disalin")
    destination: str = Field("", description="Direktori tujuan. Kosong = root")
    new_name: Optional[str] = Field(None, max_length=255, description="Nama salinan (opsional)")


class CategoryListResponse(BaseModel):
    category: str
    total: int
    total_size: int
    total_size_human: str
    truncated: bool = Field(..., description="true jika hasil dipotong oleh 'limit'")
    items: List[FileItem]


class TrashItemOut(BaseModel):
    id: str
    name: str
    original_path: str
    parent_path: str
    is_dir: bool
    size: int
    size_human: str
    extension: str = ""
    mime_type: Optional[str] = None
    deleted_at: datetime
    expires_at: datetime
    days_left: int
    deleted_by: Optional[str] = None


class TrashListResponse(BaseModel):
    total: int
    total_size: int
    total_size_human: str
    retention_days: int
    items: List[TrashItemOut]
