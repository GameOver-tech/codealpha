from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from app.core.supabase_client import get_supabase_service
from app.dependencies.auth import require_role
from app.services.storage_service import get_signed_url

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/candidates")
async def list_candidates(
    current_user: dict = Depends(require_role("admin")),
):
    """Admin-only. List all candidates with latest interview status + evaluation summary."""
    sb = get_supabase_service()

    # Fetch all candidates with their job info
    candidates_resp = (
        sb.table("candidates")
        .select("*, jobs(title)")
        .order("created_at", desc=True)
        .execute()
    )

    candidates = candidates_resp.data if candidates_resp.data else []
    result = []

    for c in candidates:
        # Get latest interview for this candidate
        interview_resp = (
            sb.table("interviews")
            .select("status, evaluations(overall_score, recommendation)")
            .eq("candidate_id", c["id"])
            .order("created_at", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )

        latest_interview = interview_resp.data if interview_resp and interview_resp.data else None
        evaluation = None
        interview_status = None

        if latest_interview:
            interview_status = latest_interview.get("status")
            evals = latest_interview.get("evaluations")
            if evals:
                evaluation = evals[0] if isinstance(evals, list) else evals

        result.append(
            {
                "id": c["id"],
                "full_name": c.get("full_name"),
                "email": c.get("email"),
                "avatar_url": c.get("avatar_url"),
                "job_title": c.get("jobs", {}).get("title") if c.get("jobs") else None,
                "interview_status": interview_status,
                "overall_score": evaluation.get("overall_score") if evaluation else None,
                "recommendation": evaluation.get("recommendation") if evaluation else None,
            }
        )

    return result


@router.get("/candidates/{candidate_id}")
async def get_candidate_detail(
    candidate_id: UUID,
    current_user: dict = Depends(require_role("admin")),
):
    """Admin-only. Full candidate detail with job, transcripts, evaluation, and signed recording URL."""
    sb = get_supabase_service()

    # Get candidate with job info
    candidate_resp = (
        sb.table("candidates")
        .select("*, jobs(*)")
        .eq("id", str(candidate_id))
        .maybe_single()
        .execute()
    )

    if not candidate_resp or not candidate_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )

    candidate = candidate_resp.data

    # Get latest interview with transcript and evaluation
    interview_resp = (
        sb.table("interviews")
        .select("*, transcripts(*), evaluations(*)")
        .eq("candidate_id", str(candidate_id))
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )

    interview = interview_resp.data if interview_resp and interview_resp.data else None
    transcript = None
    evaluation = None
    recording_url = None

    if interview:
        transcripts = interview.pop("transcripts", None)
        if transcripts:
            transcript = transcripts[0] if isinstance(transcripts, list) else transcripts

        evaluations = interview.pop("evaluations", None)
        if evaluations:
            evaluation = evaluations[0] if isinstance(evaluations, list) else evaluations

        # Generate signed URL for the recording
        storage_path = interview.get("recording_url")
        if storage_path:
            try:
                recording_url = get_signed_url(storage_path)
            except Exception:
                recording_url = None

    return {
        "id": candidate["id"],
        "full_name": candidate.get("full_name"),
        "email": candidate.get("email"),
        "avatar_url": candidate.get("avatar_url"),
        "job": candidate.get("jobs"),
        "interview": interview,
        "transcript": transcript,
        "evaluation": evaluation,
        "recording_url": recording_url,
    }
