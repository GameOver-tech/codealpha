"""Optional Redis-backed background worker for interview processing.

Runs as ``python -m app.worker`` (see docker-compose.yml). Polls a Redis
list for interview ids and executes the processing pipeline for each one.

When USE_REDIS_QUEUE=false the API falls back to FastAPI BackgroundTasks
(no worker needed) — the worker is then simply unused.
"""
from __future__ import annotations

import asyncio
import os
import signal
import sys
from contextlib import suppress
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.logging import get_logger  # noqa: E402
from app.services.pipeline_service import run_interview_pipeline  # noqa: E402

logger = get_logger(__name__)

QUEUE_KEY = "hirelens:interview-queue"
POLL_INTERVAL_SECONDS = 2.0
MAX_PROCESSING_SECONDS = 7200  # safety cap per interview

_shutdown = asyncio.Event()


def _handle_signal(signum, frame) -> None:  # noqa: ARG001
    logger.info("Received signal %s — shutting down worker", signum)
    _shutdown.set()


def _create_redis():
    """Create a Redis client or None when Redis is unavailable."""
    try:
        import redis.asyncio as aioredis
    except ImportError:
        logger.warning("redis-py not installed — worker cannot run")
        return None

    try:
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return client
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not connect to Redis: %s", exc)
        return None


async def _process_one(interview_id: str) -> None:
    """Run the pipeline for one interview in its own DB session."""
    async with AsyncSessionLocal() as db:
        try:
            await run_interview_pipeline(db, interview_id)
            logger.info("Worker processed interview %s", interview_id)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Worker failed for interview %s: %s", interview_id, exc)


async def worker_loop() -> None:
    """Poll the Redis queue and process jobs until signalled to stop."""
    if not settings.REDIS_URL:
        logger.warning("REDIS_URL not set — worker has nothing to poll. Exiting.")
        return

    client = _create_redis()
    if client is None:
        logger.error("Redis unavailable — worker exiting")
        return

    logger.info(
        "Worker started — polling %s every %ss (queue=%s)",
        settings.REDIS_URL,
        POLL_INTERVAL_SECONDS,
        QUEUE_KEY,
    )

    while not _shutdown.is_set():
        try:
            job = await client.blpop(QUEUE_KEY, timeout=POLL_INTERVAL_SECONDS)
            if job is None:
                continue
            _, interview_id = job
            logger.info("Worker picked up interview %s", interview_id)
            try:
                await asyncio.wait_for(
                    _process_one(interview_id), timeout=MAX_PROCESSING_SECONDS
                )
            except asyncio.TimeoutError:
                logger.error("Interview %s exceeded processing cap", interview_id)
        except asyncio.CancelledError:
            break
        except Exception as exc:  # noqa: BLE001
            logger.exception("Worker loop error: %s", exc)
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    with suppress(Exception):
        await client.aclose()
    logger.info("Worker stopped")


def main() -> None:
    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)
    try:
        asyncio.run(worker_loop())
    except KeyboardInterrupt:
        logger.info("Worker interrupted")


if __name__ == "__main__":
    main()
