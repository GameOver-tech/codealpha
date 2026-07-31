"""Multi-provider chat client — streaming chat completions with tool calls.

Primary provider is Groq; when it rate-limits (429) or fails transiently,
the client transparently falls back to OpenRouter (also OpenAI-compatible,
with tool-calling support). This keeps the assistant answering even when
one provider's quota is exhausted.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_TIMEOUT = 120.0
MAX_429_RETRIES = 2

# Shared connection pool — HTTP keep-alive means multi-turn tool loops reuse
# the same TLS connection instead of paying a new handshake per call.
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=DEFAULT_TIMEOUT)
    return _client


def _retryable(status_code: int) -> bool:
    """429 rate limits and 5xx server errors are worth retrying/falling back."""
    return status_code in (429,) or 500 <= status_code < 600


class GroqChatProvider:
    """OpenAI-compatible chat client with tool calling + streaming.

    Uses Groq first; falls back to OpenRouter on 429/5xx so the assistant
    keeps answering when Groq's free-tier rate limit is hit.
    """

    name = "groq-chat"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_CHAT_MODEL

    @classmethod
    def has_credentials(cls) -> bool:
        return bool(settings.GROQ_API_KEY)

    async def aclose(self) -> None:
        """Close the shared client (used by tests / shutdown hooks)."""
        global _client
        if _client is not None and not _client.is_closed:
            await _client.aclose()
        _client = None

    # --- Provider list -------------------------------------------------------

    def _providers(self) -> list[dict[str, str]]:
        """Ordered (url, api_key, model) provider list. Groq first, then any
        configured OpenAI-compatible fallback."""
        providers = [
            {
                "url": GROQ_CHAT_URL,
                "api_key": self.api_key,
                "model": self.model,
                "name": "groq",
            }
        ]
        if settings.OPENROUTER_API_KEY:
            providers.append(
                {
                    "url": OPENROUTER_CHAT_URL,
                    "api_key": settings.OPENROUTER_API_KEY,
                    "model": settings.OPENROUTER_MODEL,
                    "name": "openrouter",
                }
            )
        return providers

    # --- Streaming -----------------------------------------------------------

    async def stream(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        *,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream a chat completion, falling back across providers on 429/5xx.

        Yields dicts shaped for the agent:
          {"type": "content", "delta": str}                    — text chunk
          {"type": "tool_call", "name": str, "args": str}      — finished tool call
          {"type": "tool_call_args", "id": str, "name": str, "args_delta": str}
                                                               — streaming args fragment
        """
        payload: dict[str, Any] = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        last_error: Exception | None = None
        for provider in self._providers():
            try:
                async for event in self._stream_provider(
                    provider, payload, retries_left=MAX_429_RETRIES
                ):
                    yield event
                return
            except httpx.HTTPStatusError as exc:
                last_error = exc
                if not _retryable(exc.response.status_code):
                    raise
                logger.warning(
                    "Chat provider %s failed with %s — falling back.",
                    provider["name"],
                    exc.response.status_code,
                )
            except (TimeoutError, ConnectionError, OSError) as exc:
                last_error = exc
                logger.warning(
                    "Chat provider %s network error — falling back: %s",
                    provider["name"],
                    exc,
                )

        raise last_error or RuntimeError("No chat provider available")

    async def _stream_provider(
        self,
        provider: dict[str, str],
        payload: dict[str, Any],
        *,
        retries_left: int,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream from ONE provider, retrying 429/5xx with backoff."""
        for attempt in range(retries_left + 1):
            try:
                req_payload = {**payload, "model": provider["model"]}
                client = _get_client()
                async with client.stream(
                    "POST",
                    provider["url"],
                    headers={
                        "Authorization": f"Bearer {provider['api_key']}",
                        "Content-Type": "application/json",
                    },
                    json=req_payload,
                ) as resp:
                    resp.raise_for_status()
                    pending: dict[int, dict[str, Any]] = {}
                    async for line in resp.aiter_lines():
                        line = line.strip()
                        if not line.startswith("data:"):
                            continue
                        data = line[len("data:"):].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError:
                            continue
                        choices = chunk.get("choices") or []
                        if not choices:
                            continue
                        delta = choices[0].get("delta") or {}
                        finish = choices[0].get("finish_reason")

                        if delta.get("content"):
                            yield {"type": "content", "delta": delta["content"]}

                        for tc in delta.get("tool_calls") or []:
                            index = tc.get("index", 0)
                            frag = pending.setdefault(
                                index,
                                {"id": tc.get("id", ""), "name": "", "args": ""},
                            )
                            if tc.get("id"):
                                frag["id"] = tc["id"]
                            if tc.get("function", {}).get("name"):
                                frag["name"] = tc["function"]["name"]
                            if tc.get("function", {}).get("arguments"):
                                frag["args"] += tc["function"]["arguments"]
                                yield {
                                    "type": "tool_call_args",
                                    "id": frag["id"],
                                    "name": frag["name"],
                                    "args_delta": tc["function"]["arguments"],
                                }

                        if finish and pending:
                            for frag in pending.values():
                                yield {
                                    "type": "tool_call",
                                    "id": frag["id"],
                                    "name": frag["name"],
                                    "args": frag["args"],
                                }
                            pending.clear()
                    return
            except httpx.HTTPStatusError as exc:
                if not _retryable(exc.response.status_code) or attempt >= retries_left:
                    raise
                delay = 1.0 * (2**attempt)
                logger.warning(
                    "Chat provider %s 429/5xx (attempt %s/%s) — retrying in %.1fs",
                    provider["name"],
                    attempt + 1,
                    retries_left + 1,
                    delay,
                )
                await asyncio.sleep(delay)
