"""Konfigurasi aplikasi. Nilai dibaca dari environment variable / file .env."""
from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # Aplikasi
    APP_NAME: str = "Personal Cloud Storage API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Keamanan / JWT
    SECRET_KEY: str  # wajib diisi di .env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    # Registrasi
    ALLOW_PUBLIC_REGISTRATION: bool = False

    # Database
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'cloud_storage.db').as_posix()}"

    # Storage
    STORAGE_DIR: str = "./storage_data"
    MAX_UPLOAD_SIZE_MB: int = 0  # 0 = tanpa batas
    MIN_FREE_SPACE_MB: int = 100

    # Trash (Sampah): item dihapus permanen otomatis setelah sekian hari
    TRASH_RETENTION_DAYS: int = 30
    TRASH_PURGE_INTERVAL_MINUTES: int = 60
    UPLOAD_CHUNK_SIZE: int = 1024 * 1024
    DOWNLOAD_CHUNK_SIZE: int = 1024 * 1024

    # CORS
    CORS_ORIGINS: str = "*"

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError(
                "SECRET_KEY minimal 32 karakter. Buat dengan: "
                'python -c "import secrets; print(secrets.token_urlsafe(64))"'
            )
        return value

    @property
    def storage_root(self) -> Path:
        """Path absolut (sudah di-resolve) dari root folder penyimpanan."""
        path = Path(self.STORAGE_DIR).expanduser()
        if not path.is_absolute():
            path = BASE_DIR / path
        return path.resolve()

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
