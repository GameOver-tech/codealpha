"""Reproduce the pipeline failure-path session issue."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text


async def main():
    from app.models.base import Base
    import app.models  # noqa: F401
    from app.repositories.interview import InterviewRepository
    from app.models.interview import Interview, InterviewStatus

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as db:
        interview = Interview(candidate_id=__import__("uuid").uuid4(), status=InterviewStatus.UPLOADED)
        db.add(interview)
        await db.flush()
        iid = interview.id

        # Simulate: a stage fails after a flush (broken transaction state)
        try:
            # This insert fails (interview_id FK missing target is fine in sqlite,
            # so force a failure by violating something else — use a dup unique)
            await db.execute(text("INSERT INTO interviews (id, candidate_id, status, title, job_title, job_description, error_message, failure_reason, failure_stage, failure_traceback, duration_seconds) VALUES (:id, :cid, 'uploaded', 'x','','','','','','',0)"), {"id": str(iid), "cid": str(__import__("uuid").uuid4())})
            # Force an exception to simulate failure
            raise RuntimeError("simulated stage failure")
        except Exception:
            pass

        # Now call mark_failed on the same session
        repo = InterviewRepository(db)
        try:
            await repo.mark_failed(iid, reason="test", stage="stage1", traceback_text="tb")
            await db.commit()
            print("mark_failed OK (no rollback needed)")
        except Exception as exc:
            print("mark_failed FAILED:", type(exc).__name__, exc)
            await db.rollback()
            await repo.mark_failed(iid, reason="test", stage="stage1", traceback_text="tb")
            await db.commit()
            print("mark_failed OK after rollback")

    await engine.dispose()


asyncio.run(main())
