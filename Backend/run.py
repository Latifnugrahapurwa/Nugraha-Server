"""Launcher uvicorn.  Jalankan dengan:  python run.py"""
import os
from pathlib import Path

# Pastikan path relatif (DATABASE_URL, STORAGE_DIR) selalu terhadap folder proyek
os.chdir(Path(__file__).resolve().parent)

import uvicorn  # noqa: E402

from app.config import settings  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="debug" if settings.DEBUG else "info",
    )
