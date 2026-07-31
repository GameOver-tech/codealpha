import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, \
    BackgroundTasks, status
from fastapi.responses import JSONResponse
from uuid import UUID

from app.core.supabase_client import get_supabase_service
from app.dependencies.auth import get_current_user, require_role
from app.models.schemas import InterviewResponse
from app.services.storage_service import (
    validate_media_file,
    upload_recording,
    download_recording_to_temp,
    cleanup_temp_file,
)
from app.services.transcription_service import transcribe_audio
from app.services.evaluation_service import evaluate_transcript

router = APIRouter(prefix="/api/interviews", tags=["Interviews"])


def _ensure_candidate_row(sb, user_id: str, email: str, full_name: str, avatar_url: str, job_id: str):
    """Auto-create a candidates row if one doesn't exist for this user."""
    existing = (
        sb.table("candidates")
        .select("id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    # maybe_single() returns None (not a response object) when no row matches
    if not existing or not existing.data:
        sb.table("candidates").insert(
            {
                "id": user_id,
                "full_name": full_name,
                "email": email,
                "avatar_url": avatar_url,
                "job_id": job_id,
            }
        ).execute()


async def _process_interview_pipeline(sb, interview_id: str):
    """Run the full transcription + evaluation pipeline in the background."""
    tmp_path = None
    try:
        # Fetch interview + job details
        interview_resp = (
            sb.table("interviews")
            .select("*, jobs(*)")
            .eq("id", interview_id)
            .single()
            .execute()
        )
        interview = interview_resp.data
        recording_url = interview.get("recording_url")
        job = interview.get("jobs", {})

        if not recording_url:
            raise ValueError("No recording URL found for this interview")

        # --- Step 1: Transcribe ---
        sb.table("interviews").update({"status": "transcribing"}).eq(
            "id", interview_id
        ).execute()

        # Download recording to temp file
        tmp_path = download_recording_to_temp(recording_url)

        # Call transcription service
        transcript_text = await transcribe_audio(tmp_path)

        # Save transcript
        sb.table("transcripts").insert(
            {
                "interview_id": interview_id,
                "transcript_text": transcript_text,
            }
        ).execute()

        # --- Step 2: Evaluate ---
        sb.table("interviews").update({"status": "analyzing"}).eq(
            "id", interview_id
        ).execute()

        job_title = job.get("title", "Unknown Position")
        job_description = job.get("description", "")

        evaluation = await evaluate_transcript(job_title, job_description, transcript_text)

        # Save evaluation
        sb.table("evaluations").insert(
            {
                "interview_id": interview_id,
                "overall_score": evaluation.get("overall_score"),
                "recommendation": evaluation.get("recommendation"),
                "technical_score": evaluation.get("technical_score"),
                "communication_score": evaluation.get("communication_score"),
                "confidence_score": evaluation.get("confidence_score"),
                "problem_solving_score": evaluation.get("problem_solving_score"),
                "experience_score": evaluation.get("experience_score"),
                "strengths": evaluation.get("strengths"),
                "weaknesses": evaluation.get("weaknesses"),
                "summary": evaluation.get("summary"),
            }
        ).execute()

        # Mark completed
        sb.table("interviews").update({"status": "completed"}).eq(
            "id", interview_id
        ).execute()

    except Exception as e:
        # Never leave stuck in transcribing/analyzing
        sb.table("interviews").update(
            {
                "status": "failed",
                "error_message": str(e)[:500],
            }
        ).eq("id", interview_id).execute()

    finally:
        if tmp_path:
            cleanup_temp_file(tmp_path)


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_interview(
    file: UploadFile = File(...),
    job_id: str = Form(...),
    current_user: dict = Depends(require_role("candidate")),
):
    """Upload an interview recording. Candidate-only."""
    sb = get_supabase_service()

    # Validate file
    validate_media_file(file)

    # Validate job_id exists and is active
    job_resp = (
        sb.table("jobs")
        .select("id")
        .eq("id", job_id)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not job_resp or not job_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found or not active",
        )

    # Ensure candidate row exists
    _ensure_candidate_row(
        sb,
        current_user["id"],
        current_user["email"],
        current_user["full_name"],
        current_user["avatar_url"],
        job_id,
    )

    # Create interview row first to get the ID
    interview_id = str(uuid.uuid4())
    insert_resp = (
        sb.table("interviews")
        .insert(
            {
                "id": interview_id,
                "candidate_id": current_user["id"],
                "job_id": job_id,
                "status": "uploaded",
            }
        )
        .execute()
    )
    if not insert_resp.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create interview record",
        )

    # Upload file to storage
    try:
        storage_path = upload_recording(
            file, UUID(current_user["id"]), UUID(interview_id)
        )
        # Update the interview with the storage path
        sb.table("interviews").update({"recording_url": storage_path}).eq(
            "id", interview_id
        ).execute()
    except Exception as e:
        # Clean up the interview row if upload fails
        sb.table("interviews").delete().eq("id", interview_id).execute()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )

    return JSONResponse(
        content={"interview_id": interview_id, "status": "uploaded"},
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/{interview_id}/process", status_code=status.HTTP_202_ACCEPTED)
async def process_interview(
    interview_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role("candidate")),
):
    """Trigger the processing pipeline (transcription + evaluation) for an interview.
    Candidate must be the owner of this interview.
    Runs in the background; returns immediately with 202 Accepted.
    """
    sb = get_supabase_service()

    # Fetch interview and verify ownership
    resp = (
        sb.table("interviews")
        .select("*")
        .eq("id", str(interview_id))
        .maybe_single()
        .execute()
    )

    if not resp or not resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    interview = resp.data

    if str(interview["candidate_id"]) != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this interview",
        )

    if interview["status"] not in ("uploaded", "failed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Interview is already {interview['status']}. Only uploaded or failed interviews can be processed.",
        )

    # Kick off background processing
    background_tasks.add_task(
        _process_interview_pipeline, sb, str(interview_id)
    )

    return JSONResponse(
        content={
            "interview_id": str(interview_id),
            "status": "processing",
            "message": "Processing started. Check back via GET /api/interviews/{id} for results.",
        },
        status_code=status.HTTP_202_ACCEPTED,
    )


@router.get("/{interview_id}", response_model=InterviewResponse)
async def get_interview(
    interview_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    """Get interview details. Candidates see only their own; admins see any."""
    sb = get_supabase_service()

    query = (
        sb.table("interviews")
        .select("*, transcripts(*), evaluations(*)")
        .eq("id", str(interview_id))
        .maybe_single()
        .execute()
    )

    if not query or not query.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Interview not found",
        )

    interview = query.data

    # Candidates can only see their own
    if current_user["role"] == "candidate" and str(interview["candidate_id"]) != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this interview",
        )

    # Supabase returns nested relations as arrays — unwrap to the single
    # objects the response schema expects.
    transcripts = interview.pop("transcripts", None)
    interview["transcript"] = (
        transcripts[0] if isinstance(transcripts, list) and transcripts else None
    )
    evaluations = interview.pop("evaluations", None)
    interview["evaluation"] = (
        evaluations[0] if isinstance(evaluations, list) and evaluations else None
    )

    return interview
