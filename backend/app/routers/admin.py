from fastapi import APIRouter, Depends, HTTPException, Query
from app.middleware.auth import get_current_admin
from app.services.supabase_service import get_supabase_service
from app.models.schemas import RecommendationOverride

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/candidates")
async def list_candidates(
    search: str = Query("", description="Search by name or email"),
    job_id: str = Query("", description="Filter by job"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    admin: dict = Depends(get_current_admin),
) -> dict:
    """List all candidates with interview data (admin only)."""
    supabase = get_supabase_service()

    # Build query — get interviews with candidate + job + evaluation data
    query = supabase.table("interviews").select(
        "id, status, created_at, "
        "candidates!inner(id, full_name, email, photo_url), "
        "jobs!inner(id, title, company), "
        "evaluations(overall_score, recommendation)"
    )

    # Apply job filter
    if job_id:
        query = query.eq("job_id", job_id)

    # Execute
    result = query.order("created_at", desc=True).execute()
    all_interviews = result.data or []

    # Build candidate list
    candidates_map = {}
    for interview in all_interviews:
        candidate = interview.get("candidates", {})
        cand_id = candidate.get("id")
        if not cand_id:
            continue

        if cand_id not in candidates_map:
            candidates_map[cand_id] = {
                "id": cand_id,
                "full_name": candidate.get("full_name", ""),
                "email": candidate.get("email", ""),
                "photo_url": candidate.get("photo_url"),
                "job_title": interview.get("jobs", {}).get("title", ""),
                "overall_score": None,
                "recommendation": None,
                "status": interview.get("status"),
                "interview_date": interview.get("created_at", ""),
            }

        # Override with most recent interview's evaluation
        evaluation = interview.get("evaluations")
        if evaluation:
            candidates_map[cand_id]["overall_score"] = evaluation.get("overall_score")
            candidates_map[cand_id]["recommendation"] = evaluation.get("recommendation")

    # Convert to list and apply search filter
    candidates_list = list(candidates_map.values())
    if search:
        search_lower = search.lower()
        candidates_list = [
            c for c in candidates_list
            if search_lower in c["full_name"].lower() or search_lower in c["email"].lower()
        ]

    # Paginate
    total = len(candidates_list)
    start = (page - 1) * per_page
    end = start + per_page
    page_items = candidates_list[start:end]

    return {"candidates": page_items, "total": total}


@router.get("/jobs")
async def list_jobs(admin: dict = Depends(get_current_admin)) -> dict:
    """List all jobs for the filter dropdown (admin only)."""
    supabase = get_supabase_service()
    result = supabase.table("jobs").select("id, title").execute()
    return {"jobs": result.data}


@router.get("/candidates/{candidate_id}")
async def get_candidate_detail(
    candidate_id: str,
    admin: dict = Depends(get_current_admin),
) -> dict:
    """Get full candidate report data."""
    supabase = get_supabase_service()

    # Get candidate info
    candidate = supabase.table("candidates").select("*").eq("id", candidate_id).single().execute()
    if not candidate.data:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Get their interviews
    interviews = supabase.table("interviews").select("*").eq("candidate_id", candidate_id).order("created_at", desc=True).execute()
    if not interviews.data:
        return {
            "candidate": candidate.data,
            "job": None,
            "interview_status": None,
            "interview_date": None,
            "audio_url": None,
            "transcript": None,
            "evaluation": None,
        }

    latest_interview = interviews.data[0]

    # Get job details
    job = supabase.table("jobs").select("*").eq("id", latest_interview["job_id"]).single().execute()

    # Get transcript
    transcript = supabase.table("transcripts").select("*").eq("interview_id", latest_interview["id"]).single().execute()

    # Get evaluation
    evaluation = supabase.table("evaluations").select("*").eq("interview_id", latest_interview["id"]).single().execute()

    return {
        "candidate": candidate.data,
        "job": job.data if job.data else None,
        "interview_status": latest_interview.get("status"),
        "interview_date": latest_interview.get("created_at"),
        "audio_url": latest_interview.get("audio_url"),
        "transcript": transcript.data if transcript.data else None,
        "evaluation": evaluation.data if evaluation.data else None,
    }


@router.post("/candidates/{candidate_id}/recommendation")
async def override_recommendation(
    candidate_id: str,
    body: RecommendationOverride,
    admin: dict = Depends(get_current_admin),
) -> dict:
    """Manually override a candidate's AI-generated recommendation (admin only)."""
    supabase = get_supabase_service()

    if body.recommendation not in ("Recommended", "Not Recommended", "Need Further Review"):
        raise HTTPException(
            status_code=400,
            detail="Invalid recommendation. Use 'Recommended', 'Not Recommended', or 'Need Further Review'.",
        )

    # Find the latest interview for this candidate
    interviews = supabase.table("interviews").select("id").eq("candidate_id", candidate_id).order("created_at", desc=True).execute()
    if not interviews.data:
        raise HTTPException(status_code=404, detail="No interviews found for this candidate")

    latest_interview_id = interviews.data[0]["id"]

    # Find and update the evaluation
    evaluation = supabase.table("evaluations").select("id").eq("interview_id", latest_interview_id).execute()
    if not evaluation.data:
        raise HTTPException(status_code=404, detail="No evaluation found for this interview")

    supabase.table("evaluations").update({
        "recommendation": body.recommendation,
    }).eq("id", evaluation.data[0]["id"]).execute()

    return {"recommendation": body.recommendation}
