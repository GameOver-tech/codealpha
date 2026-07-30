from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.middleware.auth import get_current_candidate
from app.services.supabase_service import get_supabase_service
from app.models.schemas import CandidateInterviewItem


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    photo_url: Optional[str] = None


router = APIRouter(prefix="/api/candidates", tags=["candidates"])


@router.get("/me/interviews")
async def get_my_interviews(
    candidate: dict = Depends(get_current_candidate),
) -> dict:
    """Get all interviews for the current candidate with job info and evaluation."""
    supabase = get_supabase_service()
    candidate_id = candidate["id"]

    interviews = (
        supabase.table("interviews")
        .select(
            "id, status, created_at, "
            "jobs!inner(title, company), "
            "evaluations(overall_score, recommendation)"
        )
        .eq("candidate_id", candidate_id)
        .order("created_at", desc=True)
        .execute()
    )

    items = []
    for interview in interviews.data or []:
        job = interview.get("jobs", {})
        evaluation = interview.get("evaluations")
        items.append({
            "id": interview["id"],
            "job_title": job.get("title", ""),
            "job_company": job.get("company", ""),
            "status": interview.get("status", ""),
            "overall_score": evaluation.get("overall_score") if evaluation else None,
            "recommendation": evaluation.get("recommendation") if evaluation else None,
            "interview_date": interview.get("created_at", ""),
        })

    return {"interviews": items}


@router.put("/me/profile")
async def update_profile(
    body: ProfileUpdate,
    candidate: dict = Depends(get_current_candidate),
) -> dict:
    """Update the current candidate's profile (name, photo)."""
    supabase = get_supabase_service()
    updates = {}
    if body.full_name is not None:
        updates["full_name"] = body.full_name
    if body.photo_url is not None:
        updates["photo_url"] = body.photo_url
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    supabase.table("candidates").update(updates).eq("id", candidate["id"]).execute()
    return updates
