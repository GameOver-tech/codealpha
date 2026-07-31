from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from app.core.supabase_client import get_supabase_service
from app.dependencies.auth import get_current_user, require_role
from app.models.schemas import JobCreate, JobResponse

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


@router.get("", response_model=list[JobResponse])
async def list_jobs():
    """Public endpoint — list all active jobs."""
    sb = get_supabase_service()
    resp = (
        sb.table("jobs")
        .select("id, title, description, is_active, created_at")
        .eq("is_active", True)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data if resp.data else []


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job: JobCreate,
    current_user: dict = Depends(require_role("admin")),
):
    """Admin-only — create a new job posting."""
    sb = get_supabase_service()
    payload = job.model_dump()
    payload["created_by"] = current_user["id"]

    resp = sb.table("jobs").insert(payload).execute()
    if not resp.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create job",
        )
    return resp.data[0]
