from fastapi import APIRouter, HTTPException
from app.services.supabase_service import get_supabase

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


@router.get("")
async def list_jobs():
    """List all active jobs."""
    supabase = get_supabase()
    result = supabase.table("jobs").select("*").eq("is_active", True).execute()
    return {"jobs": result.data}


@router.get("/{job_id}")
async def get_job(job_id: str):
    """Get a single job by ID."""
    supabase = get_supabase()
    result = supabase.table("jobs").select("*").eq("id", job_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")
    return result.data
