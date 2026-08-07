import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import get_logger
from app.routers import admin, auth, chat, health, interviews, jobs, live_interview, profile, tts
from app.utils.exceptions import TranscriptionError

logger = get_logger(__name__)


async def _run_migrations() -> None:
    """Apply pending Alembic migrations before serving requests.

    Runs in a thread so Alembic's sync/async entrypoint (``env.py`` uses
    ``asyncio.run``) never collides with the app's running event loop.
    """
    from pathlib import Path

    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parent.parent
    cfg = Config(str(backend_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_dir / "migrations"))
    await asyncio.to_thread(command.upgrade, cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown hooks.

    On startup, ensure the database schema is up to date, then sweep any
    interviews left stuck in 'processing' (e.g. from a crashed worker) into
    the terminal FAILED state so nothing is ever stuck forever.
    """
    try:
        await _run_migrations()
        logger.info("Database migrations are up to date.")

        from app.core.database import AsyncSessionLocal
        from app.services.pipeline_service import (
            sweep_orphaned_media,
            sweep_stuck_interviews,
        )

        async with AsyncSessionLocal() as db:
            recovered = await sweep_stuck_interviews(db)
            if recovered:
                logger.warning(
                    "Startup sweep recovered %s stuck interview(s)", recovered
                )
            purged = await sweep_orphaned_media(db)
            if purged:
                logger.info(
                    "Startup media sweep purged %s orphaned file(s)", purged
                )
    except Exception:  # noqa: BLE001
        logger.exception("Startup initialization failed")
    yield


app = FastAPI(
    title="HireLens AI Backend",
    description="AI-powered talent evaluation platform API",
    version="1.0.0",
    lifespan=lifespan,
    # Disable built-in CDN links that cause 404 blank pages
    docs_url=None,
    redoc_url=None,
)

# CORS is driven by CORS_ORIGINS (comma-separated list in .env). This is
# required in production: with allow_credentials=True, browsers reject the
# "*" wildcard, so the real Vercel origin must be listed explicitly.
if settings.cors_origin_list:
    allow_origins = settings.cors_origin_list
    allow_credentials = True
else:
    # Dev fallback — no CORS_ORIGINS set: allow everything, no credentials.
    allow_origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(TranscriptionError)
async def transcription_error_handler(request: Request, exc: TranscriptionError):
    """Return the exact 500 contract when transcription fails.

    Processing never continues past a failed transcription — no AI
    evaluation, no report, no PDF is produced.
    """
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Transcription failed.",
            "reason": str(exc),
        },
    )


# --- ReDoc / Swagger docs ------------------------------------------------------
# FastAPI's default docs CDN tag breaks. We use get_swagger_ui_html and
# get_redoc_html with pinned CSS and JS assets to ensure styling and scripts render properly.


@app.get("/docs", include_in_schema=False)
async def swagger_html():
    return get_swagger_ui_html(
        openapi_url="/openapi.json",
        title="HireLens AI Backend - Swagger UI",
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css",
    )


@app.get("/redoc", include_in_schema=False)
async def redoc_html():
    return get_redoc_html(
        openapi_url="/openapi.json",
        title="HireLens AI Backend - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js",
    )


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(interviews.router)
app.include_router(profile.router)
app.include_router(admin.router)
app.include_router(live_interview.router)
app.include_router(chat.router)
app.include_router(tts.router)

# Serve locally-stored uploads (avatars, recordings, generated PDFs) at /media.
# Supabase Storage sync replaces this in production, but local dev must work.
app.mount(
    "/media",
    StaticFiles(directory=settings.UPLOAD_DIR, check_dir=False),
    name="media",
)
app.mount(
    "/generated",
    StaticFiles(directory=settings.GENERATED_DIR, check_dir=False),
    name="generated",
)