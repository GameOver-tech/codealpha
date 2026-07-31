from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from app.core.logging import get_logger
from app.routers import health, auth, jobs, interviews, profile, admin
from app.utils.exceptions import TranscriptionError

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown hooks.

    On startup, sweep any interviews left stuck in 'processing' (e.g. from
    a crashed worker) into the terminal FAILED state so nothing is ever
    stuck forever.
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.pipeline_service import sweep_stuck_interviews

        async with AsyncSessionLocal() as db:
            recovered = await sweep_stuck_interviews(db)
            if recovered:
                logger.warning("Startup sweep recovered %s stuck interview(s)", recovered)
    except Exception:  # noqa: BLE001
        logger.exception("Startup stuck-interview sweep failed")
    yield


app = FastAPI(
    title="HireLens AI Backend",
    description="AI-powered talent evaluation platform API",
    version="1.0.0",
    lifespan=lifespan,
    # Disable the built-in docs pages — they load a broken `redoc@next`
    # CDN tag that 404s, leaving the page blank. Custom /docs and /redoc
    # routes below serve pinned, working CDN builds instead.
    docs_url=None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
# FastAPI's built-in templates load ReDoc via the `redoc@next` CDN tag, which is
# no longer served (404), leaving the docs page blank. Pin a known-good release
# instead so /redoc and /docs render reliably.

_REDOC_HTML = """<!DOCTYPE html>
<html>
<head>
<title>HireLens AI Backend - ReDoc</title>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { margin: 0; padding: 0; }</style>
</head>
<body>
<noscript>ReDoc requires Javascript to function. Please enable it to browse the documentation.</noscript>
<redoc spec-url="/openapi.json"></redoc>
<script src="https://cdn.jsdelivr.net/npm/redoc@2.1.5/bundles/redoc.standalone.js"></script>
</body>
</html>
"""

_SWAGGER_HTML = """<!DOCTYPE html>
<html>
<head>
<title>HireLens AI Backend - Swagger UI</title>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { margin: 0; padding: 0; }</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>
  window.onload = function () {
    SwaggerUIBundle({
      url: "/openapi.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
    });
  };
</script>
</body>
</html>
"""


@app.get("/redoc", response_class=HTMLResponse, include_in_schema=False)
async def redoc_html():
    return HTMLResponse(_REDOC_HTML)


@app.get("/docs", response_class=HTMLResponse, include_in_schema=False)
async def swagger_html():
    return HTMLResponse(_SWAGGER_HTML)


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(interviews.router)
app.include_router(profile.router)
app.include_router(admin.router)
