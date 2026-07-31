"""Rate limiting middleware — in-process sliding window per client IP.

Simple, dependency-free implementation. When REDIS_URL is configured and
redis-py is available, a shared Redis-backed limiter is used instead so
multiple workers enforce one limit.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# In-process state: {key: deque of event timestamps}
_buckets: defaultdict[str, deque[float]] = defaultdict(deque)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Reject requests that exceed the configured per-window limit."""

    def __init__(self, app):
        super().__init__(app)
        self.enabled = settings.ENABLE_RATE_LIMITING
        self.max_requests = settings.RATE_LIMIT_REQUESTS
        self.period = settings.RATE_LIMIT_PERIOD_SECONDS
        self._redis = None
        if self.enabled and settings.REDIS_URL and settings.REDIS_URL != "redis://localhost:6379/0":
            try:
                import redis.asyncio as aioredis

                self._redis = aioredis.from_url(settings.REDIS_URL)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Redis rate limiter unavailable — using in-process: %s", exc)
                self._redis = None

    def _client_key(self, request: Request) -> str:
        ip = request.client.host if request.client else "unknown"
        return f"rl:{ip}"

    async def _is_allowed_inproc(self, key: str) -> bool:
        now = time.monotonic()
        bucket = _buckets[key]
        while bucket and now - bucket[0] > self.period:
            bucket.popleft()
        if len(bucket) >= self.max_requests:
            return False
        bucket.append(now)
        return True

    async def _is_allowed_redis(self, key: str) -> bool:
        try:
            pipe = self._redis.pipeline()
            pipe.lpush(key, time.time())
            pipe.ltrim(key, 0, self.max_requests - 1)
            pipe.expire(key, self.period * 2)
            pipe.llen(key)
            _, _, _, count = await pipe.execute()
            return int(count) <= self.max_requests
        except Exception as exc:  # noqa: BLE001
            logger.warning("Redis rate-limit check failed: %s", exc)
            return True

    async def dispatch(self, request: Request, call_next):
        if not self.enabled or request.url.path.startswith(("/docs", "/redoc", "/openapi.json", "/api/health")):
            return await call_next(request)

        key = self._client_key(request)
        if self._redis is not None:
            allowed = await self._is_allowed_redis(key)
        else:
            allowed = await self._is_allowed_inproc(key)

        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Too many requests. Please try again later.",
                    "retry_after": self.period,
                },
                headers={"Retry-After": str(self.period)},
            )
        return await call_next(request)
