"""Base protocol for LLM providers + retry helper."""
import asyncio
from abc import ABC, abstractmethod
from typing import Any

from app.core.logging import get_logger
from app.utils.exceptions import BadRequestError

logger = get_logger(__name__)


class LLMProvider(ABC):
    """Interface implemented by every LLM provider adapter."""

    @abstractmethod
    async def complete(self, prompt: str, *, max_tokens: int, temperature: float) -> str:
        """Run a single-turn completion and return the raw text."""
        raise NotImplementedError


async def with_retries(
    coro_factory,
    *,
    attempts: int = 3,
    base_delay: float = 1.0,
) -> Any:
    """Run coro_factory() with exponential backoff on transient failures."""
    last_exc: Exception | None = None
    for attempt in range(attempts):
        try:
            return await coro_factory()
        except (TimeoutError, ConnectionError, OSError) as exc:
            last_exc = exc
            delay = base_delay * (2**attempt)
            logger.warning("LLM call failed (attempt %s/%s): %s. Retrying in %.1fs", attempt + 1, attempts, exc, delay)
            await asyncio.sleep(delay)
    raise BadRequestError(f"LLM provider unavailable after {attempts} attempts: {last_exc}")
