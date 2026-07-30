import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, jobs, interviews, admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="HireLens AI API",
    description="AI-powered talent evaluation platform",
    version="1.0.0",
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(interviews.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {"message": "HireLens AI API is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
