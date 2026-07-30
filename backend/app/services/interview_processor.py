import asyncio
import json
import logging
import os
import subprocess
from uuid import UUID

from app.config import settings
from app.services.supabase_service import get_supabase_service
from app.services.deepgram_service import transcribe_audio
from app.services.groq_service import refine_transcript
from app.services.openrouter_service import evaluate as openrouter_evaluate
from app.services.gemini_service import evaluate as gemini_evaluate

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


def _upload_file(client, local_path: str, remote_path: str) -> str:
    """Upload a file to Supabase Storage and return the public URL."""
    with open(local_path, "rb") as f:
        client.storage.from_("interview-files").upload(remote_path, f)
    # Return the signed URL for the file
    return client.storage.from_("interview-files").get_public_url(remote_path)


def _reconcile_evaluations(or_result: dict, gemini_result: dict) -> dict:
    """Reconcile OpenRouter and Gemini evaluations into a single result."""
    reconciled = {}

    # Average scores, log if gap > 15
    score_fields = [
        "technical_score", "communication_score", "confidence_score",
        "problem_solving_score", "experience_score", "overall_score",
    ]
    for field in score_fields:
        o = or_result.get(field, 0) or 0
        g = gemini_result.get(field, 0) or 0
        avg = round((float(o) + float(g)) / 2, 2)
        reconciled[field] = avg
        if abs(float(o) - float(g)) > 15:
            logger.warning(
                f"Score disagreement on {field}: OpenRouter={o}, Gemini={g}, using average={avg}"
            )

    # Recommendation
    or_rec = or_result.get("recommendation", "")
    gem_rec = gemini_result.get("recommendation", "")
    if or_rec == gem_rec:
        reconciled["recommendation"] = or_rec
    else:
        reconciled["recommendation"] = "Need Further Review"
        logger.warning(
            f"Recommendation disagreement: OpenRouter={or_rec}, Gemini={gem_rec}, using Need Further Review"
        )

    # Merge strengths (deduplicated)
    strengths = set()
    for s in or_result.get("strengths", []):
        strengths.add(s)
    for s in gemini_result.get("strengths", []):
        strengths.add(s)
    reconciled["strengths"] = list(strengths)

    # Merge weaknesses (deduplicated)
    weaknesses = set()
    for w in or_result.get("weaknesses", []):
        weaknesses.add(w)
    for w in gemini_result.get("weaknesses", []):
        weaknesses.add(w)
    reconciled["weaknesses"] = list(weaknesses)

    # Pick the longer AI summary
    or_summary = or_result.get("ai_summary", "") or ""
    gem_summary = gemini_result.get("ai_summary", "") or ""
    reconciled["ai_summary"] = or_summary if len(or_summary) >= len(gem_summary) else gem_summary

    # Merge evidence per category
    or_evidence = or_result.get("evidence", {}) or {}
    gem_evidence = gemini_result.get("evidence", {}) or {}
    all_categories = set(list(or_evidence.keys()) + list(gem_evidence.keys()))
    merged_evidence = {}
    for cat in all_categories:
        items = []
        seen = set()
        for item in or_evidence.get(cat, []) + gem_evidence.get(cat, []):
            quote = item.get("quote", "")
            if quote and quote not in seen:
                seen.add(quote)
                items.append(item)
        if items:
            merged_evidence[cat] = items
    reconciled["evidence"] = merged_evidence

    return reconciled


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
            # Already audio — just rename/copy
            import shutil
            shutil.copy2(local_video, audio_path)

        raw_transcript = await transcribe_audio(audio_path)
        client.table("transcripts").upsert({
            "interview_id": str(interview_id),
            "raw_transcript": raw_transcript,
        }).execute()

        # --- Stage 2: Analyzing ---
        client.table("interviews").update({"status": "analyzing"}).eq("id", str(interview_id)).execute()

        # Refine transcript with Groq
        refined_transcript = await refine_transcript(raw_transcript)
        client.table("transcripts").update({
            "refined_transcript": refined_transcript,
        }).eq("interview_id", str(interview_id)).execute()

        # Get job details for context
        interview = client.table("interviews").select("job_id").eq("id", str(interview_id)).single().execute()
        job = client.table("jobs").select("*").eq("id", interview.data["job_id"]).single().execute()
        job_data = job.data

        # Evaluate with OpenRouter and Gemini in parallel
        or_task = asyncio.create_task(openrouter_evaluate(refined_transcript, job_data))
        gemini_task = asyncio.create_task(gemini_evaluate(refined_transcript, job_data))
        or_result, gemini_result = await asyncio.gather(or_task, gemini_task, return_exceptions=True)

        # Handle individual failures gracefully
        if isinstance(or_result, Exception):
            logger.error(f"OpenRouter evaluation failed: {or_result}")
            or_result = {
                "technical_score": 0, "communication_score": 0, "confidence_score": 0,
                "problem_solving_score": 0, "experience_score": 0, "overall_score": 0,
                "recommendation": "Need Further Review", "strengths": [], "weaknesses": [],
                "ai_summary": "Evaluation from OpenRouter was unavailable.", "evidence": {},
            }
        if isinstance(gemini_result, Exception):
            logger.error(f"Gemini evaluation failed: {gemini_result}")
            gemini_result = {
                "technical_score": 0, "communication_score": 0, "confidence_score": 0,
                "problem_solving_score": 0, "experience_score": 0, "overall_score": 0,
                "recommendation": "Need Further Review", "strengths": [], "weaknesses": [],
                "ai_summary": "Evaluation from Gemini was unavailable.", "evidence": {},
            }

        # Reconcile the two evaluations
        reconciled = _reconcile_evaluations(or_result, gemini_result)

        # Save evaluation
        client.table("evaluations").upsert({
            "interview_id": str(interview_id),
            "technical_score": reconciled["technical_score"],
            "communication_score": reconciled["communication_score"],
            "confidence_score": reconciled["confidence_score"],
            "problem_solving_score": reconciled["problem_solving_score"],
            "experience_score": reconciled["experience_score"],
            "overall_score": reconciled["overall_score"],
            "recommendation": reconciled["recommendation"],
            "strengths": reconciled["strengths"],
            "weaknesses": reconciled["weaknesses"],
            "ai_summary": reconciled["ai_summary"],
            "evidence": json.dumps(reconciled["evidence"]),
        }).execute()

        # --- Stage 3: Completed ---
        client.table("interviews").update({"status": "completed"}).eq("id", str(interview_id)).execute()
        logger.info(f"Interview {interview_id} processing completed successfully")

    except Exception as e:
        logger.error(f"Interview {interview_id} processing failed: {e}")
        client.table("interviews").update({"status": "completed"}).eq("id", str(interview_id)).execute()
        # Save a minimal evaluation so the status page doesn't hang
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
        # Clean up temp files
        try:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass
