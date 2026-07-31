"""Run the real pipeline against the local DB with no Deepgram key."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


async def main():
    from app.core.database import AsyncSessionLocal
    from app.repositories.interview import InterviewRepository
    from app.models.interview import InterviewStatus
    from app.services.pipeline_service import run_interview_pipeline

    # Create a fresh interview with a dummy file row
    from app.models.interview_file import InterviewFile
    from app.models.user import User, UserRole

    async with AsyncSessionLocal() as db:
        # Make the script idempotent: reuse the existing test user if present.
        from app.repositories.user import UserRepository

        admin = await UserRepository(db).get_by(email="pipe-test@x.com")
        if admin is None:
            admin = User(email="pipe-test@x.com", first_name="P", last_name="T", role=UserRole.ADMIN)
            db.add(admin)
            await db.flush()

        interview = await InterviewRepository(db).create(candidate_id=admin.id, job_title="Backend")
        await db.flush()
        from pathlib import Path as P

        upload_dir = P(r"E:\HireLens-AI-Backend\uploads") / "recordings" / str(interview.id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        f = upload_dir / "sample.wav"
        f.write_bytes(b"\x00" * 100)
        db.add(
            InterviewFile(
                interview_id=interview.id,
                original_filename="sample.wav",
                storage_path=f"recordings/{interview.id}/sample.wav",
                content_type="audio/wav",
                file_size_bytes=100,
            )
        )
        await db.commit()
        iid = str(interview.id)
        print("interview:", iid)

    try:
        async with AsyncSessionLocal() as db:
            await run_interview_pipeline(db, iid)
        print("pipeline returned (unexpected)")
    except Exception as exc:
        print("pipeline raised:", type(exc).__name__, exc)

    async with AsyncSessionLocal() as db:
        interview = await InterviewRepository(db).get(iid)
        print("status:", interview.status.value)
        print("failure_reason:", interview.failure_reason)
        print("failure_stage:", interview.failure_stage)
        print("processing_finished_at:", interview.processing_finished_at)
        print("traceback len:", len(interview.failure_traceback))


asyncio.run(main())
