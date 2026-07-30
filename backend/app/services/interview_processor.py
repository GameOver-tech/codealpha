import json
import logging
import os
import shutil
import subprocess
from uuid import UUID

from app.services.supabase_service import get_supabase_service
from app.services.whisper_service import transcribe_audio
from app.services.claude_service import evaluate as claude_evaluate

logger = logging.getLogger(__name__)


def _convert_video_to_audio(video_path: str, audio_path: str):
    """Convert video file to audio using ffmpeg."""
    try:
        subprocess.run(
            ["ffmpeg", "-i", video_path, "-vn", "-acodec", "pcm_s16le",
             "-ar", "16000", "-ac", "1", audio_path, "-y"],
            capture_output=True, check=True, timeout=300,
        )
        logger.info(f"Converted {video_path} to {audio_path}")
    except subprocess.CalledProcessError as e:
        logger.error(f"ffmpeg conversion failed: {e.stderr.decode()}")
        raise
    except FileNotFoundError:
        logger.error("ffmpeg not found — install ffmpeg and ensure it is in PATH")
        raise


def _download_file(client, url: str, local_path: str):
    """Download a file from Supabase Storage."""
    with open(local_path, "wb") as f:
        res = client.storage.from_("interview-files").download(url)
        f.write(res)


async def process_interview(interview_id: UUID, storage_path: str, is_video: bool):
    """Background task: process an interview through the full pipeline."""
    client = get_supabase_service()
    temp_dir = f"/tmp/interviews/{interview_id}"
    os.makedirs(temp_dir, exist_ok=True)

    try:
        # --- Stage 1: Transcribing ---
        client.table("interviews").update({"status": "transcribing"}).eq("id", str(interview_id)).execute()

        local_video = os.path.join(temp_dir, "input")
        _download_file(client, storage_path, local_video)

        audio_path = os.path.join(temp_dir, "audio.wav")
        if is_video:
            _convert_video_to_audio(local_video, audio_path)
        else:
            shutil.copy2(local_video, audio_path)

        transcript = await transcribe_audio(audio_path)
        client.table("transcripts").upsert({
            "interview_id": str(interview_id),
            "raw_transcript": transcript,
            "refined_transcript": transcript,
        }).execute()

        # --- Stage 2: Analyzing ---
        client.table("interviews").update({"status": "analyzing"}).eq("id", str(interview_id)).execute()

        # Get job details for context
        interview = client.table("interviews").select("job_id").eq("id", str(interview_id)).single().execute()
        job = client.table("jobs").select("*").eq("id", interview.data["job_id"]).single().execute()
        job_data = job.data

        # Evaluate with Claude
        evaluation = await claude_evaluate(transcript, job_data)

        # Map Claude's field names to database column names (summary -> ai_summary)
        db_evaluation = {
            "interview_id": str(interview_id),
            "technical_score": evaluation.get("technical_score", 0),
            "communication_score": evaluation.get("communication_score", 0),
            "confidence_score": evaluation.get("confidence_score", 0),
            "problem_solving_score": evaluation.get("problem_solving_score", 0),
            "experience_score": evaluation.get("experience_score", 0),
            "overall_score": evaluation.get("overall_score", 0),
            "recommendation": evaluation.get("recommendation", "Need Further Review"),
            "strengths": evaluation.get("strengths", []),
            "weaknesses": evaluation.get("weaknesses", []),
            "ai_summary": evaluation.get("summary", ""),
            "evidence": "{}",
        }

        client.table("evaluations").upsert(db_evaluation).execute()

        # --- Stage 3: Completed ---
        client.table("interviews").update({"status": "completed"}).eq("id", str(interview_id)).execute()
        logger.info(f"Interview {interview_id} processing completed successfully")

    except Exception as e:
        logger.error(f"Interview {interview_id} processing failed: {e}")
        client.table("interviews").update({"status": "failed"}).eq("id", str(interview_id)).execute()
        # Save a minimal fallback evaluation so the UI doesn't hang
        client.table("evaluations").upsert({
            "interview_id": str(interview_id),
            "technical_score": 0, "communication_score": 0, "confidence_score": 0,
            "problem_solving_score": 0, "experience_score": 0, "overall_score": 0,
            "recommendation": "Need Further Review",
            "strengths": [], "weaknesses": [],
            "ai_summary": f"Processing encountered an error: {str(e)}",
            "evidence": "{}",
        }).execute()
    finally:
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass
