from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import health, auth, jobs, interviews, profile, admin
from app.utils.exceptions import TranscriptionError

app = FastAPI(
    title="HireLens AI Backend",
    description="AI-powered talent evaluation platform API",
    version="1.0.0",
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


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(interviews.router)
app.include_router(profile.router)
app.include_router(admin.router)
