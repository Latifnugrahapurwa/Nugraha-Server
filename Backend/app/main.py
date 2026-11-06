"""Entry point FastAPI: konfigurasi app, CORS, middleware, dan registrasi router."""
import asyncio
import contextlib
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  (memastikan tabel terdaftar di metadata)
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import auth_router, file_router, system_router, trash_router
from app.utils.file_utils import get_trash_root
from app.utils.trash_utils import purge_expired

logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO)
logger = logging.getLogger("cloud-storage")


def _purge_once() -> int:
    with SessionLocal() as db:
        return purge_expired(db)


async def _purge_loop() -> None:
    """Bersihkan Sampah yang melewati masa simpan (saat start, lalu berkala)."""
    interval = max(settings.TRASH_PURGE_INTERVAL_MINUTES, 1) * 60
    while True:
        try:
            removed = await asyncio.to_thread(_purge_once)
            if removed:
                logger.info("Sampah: %d item kedaluwarsa dihapus permanen", removed)
        except Exception:
            logger.exception("Gagal membersihkan Sampah")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.storage_root.mkdir(parents=True, exist_ok=True)
    get_trash_root().mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    logger.info("Storage root : %s", settings.storage_root)
    logger.info("Database     : %s", settings.DATABASE_URL)
    logger.info("Sampah       : disimpan %d hari", settings.TRASH_RETENTION_DAYS)

    purge_task = asyncio.create_task(_purge_loop())
    try:
        yield
    finally:
        purge_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await purge_task


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API untuk Cloud Storage pribadi (self-hosted).",
    lifespan=lifespan,
)


@app.middleware("http")
async def security_and_timing_headers(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{(time.perf_counter() - started) * 1000:.2f}ms"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"  # token bisa ada di query string untuk streaming media
    return response


# Ditambahkan setelah middleware di atas agar CORS menjadi lapisan terluar
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,  # autentikasi via header Bearer, bukan cookie
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Range", "Content-Length", "Accept-Ranges"],
)

app.include_router(auth_router.router)
app.include_router(file_router.router)
app.include_router(trash_router.router)
app.include_router(system_router.router)


@app.get("/", tags=["Root"])
def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs"}
