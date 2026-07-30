import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks

from app.middleware.auth import get_current_candidate, get_current_admin
from app.models.schemas import InterviewStatusResponse
from app.services.supabase_service import get_supabase_service
from app.services.interview_processor import process_interview

router = APIRouter(prefix="/api/interviews", tags=["interviews"])

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm", ".mkv", ".mp3", ".wav", ".m4a", ".ogg"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB


@router.post("/upload")
async def upload_interview(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    job_id: str = Form(...),
    user: dict = Depends(get_current_candidate),
) -> dict:
    """Upload an interview recording and start processing."""
    # Validate file extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 500 MB")

    # Determine if it's video or audio
    video_extensions = {".mp4", ".mov", ".avi", ".webm", ".mkv"}
    is_video = ext in video_extensions

    # Create interview record
    supabase = get_supabase_service()
    interview_id = str(uuid.uuid4())
    storage_path = f"{user['id']}/{interview_id}{ext}"

    # Upload to Supabase Storage
    try:
        supabase.storage.from_("interview-files").upload(storage_path, content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    # Create interview row (store storage path, not public URL)
    interview_data = {
        "id": interview_id,
        "candidate_id": user["id"],
        "job_id": job_id,
        "status": "uploaded",
    }
    if is_video:
        interview_data["video_url"] = storage_path
    else:
        interview_data["audio_url"] = storage_path

    supabase.table("interviews").insert(interview_data).execute()

    # Start background processing — pass storage path for download
    background_tasks.add_task(
        process_interview,
        interview_id=uuid.UUID(interview_id),
        storage_path=storage_path,
        is_video=is_video,
    )

    return {"interview_id": interview_id, "status": "uploaded"}


@router.get("/{interview_id}/status")
async def get_interview_status(
    interview_id: str,
    user: dict = Depends(get_current_candidate),
) -> InterviewStatusResponse:
    """Get the current status and progress of an interview."""
    supabase = get_supabase_service()
    result = supabase.table("interviews").select("status").eq("id", interview_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Interview not found")

    status = result.data["status"]
    progress_map = {
        "uploaded": 0,
        "transcribing": 25,
        "analyzing": 60,
        "completed": 100,
        "failed": 0,
    }

    return InterviewStatusResponse(
        id=interview_id,
        status=status,
        progress_pct=progress_map.get(status, 0),
    )


@router.post("/{interview_id}/process")
async def trigger_process(
    interview_id: str,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(get_current_admin),
) -> dict:
    """Manually trigger or retry processing for an interview (admin only)."""
    supabase = get_supabase_service()
    result = supabase.table("interviews").select("status, video_url, audio_url").eq("id", interview_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Interview not found")

    interview = result.data
    storage_path = interview.get("video_url") or interview.get("audio_url")
    if not storage_path:
        raise HTTPException(status_code=400, detail="No recording file found for this interview")

    is_video = interview.get("video_url") is not None

    # Reset status and trigger processing
    supabase.table("interviews").update({"status": "uploaded"}).eq("id", interview_id).execute()
    background_tasks.add_task(
        process_interview,
        interview_id=uuid.UUID(interview_id),
        storage_path=storage_path,
        is_video=is_video,
    )

    return {"interview_id": interview_id, "status": "processing triggered"}
