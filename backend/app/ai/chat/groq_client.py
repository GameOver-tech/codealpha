"""Groq chat client — streaming chat completions with tool (function) calls.

Implements the OpenAI-compatible ``/v1/chat/completions`` protocol against
Groq, mirroring the existing single-turn ``GroqProvider`` style but adding
multi-turn ``messages``, ``tools`` (strict function calling) and SSE streaming.
"""
from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_TIMEOUT = 120.0


class GroqChatProvider:
    """OpenAI-compatible Groq chat client with tool calling + streaming."""

    name = "groq-chat"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_CHAT_MODEL

    @classmethod
    def has_credentials(cls) -> bool:
        return bool(settings.GROQ_API_KEY)

    async def chat_once(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        *,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> dict[str, Any]:
        """Single non-streaming completion — returns the full message dict.

        Used by the agent for calls that only return tool calls (no content).
        """
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            resp = await client.post(
                GROQ_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]

    async def stream(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        *,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream a chat completion, yielding parsed SSE events.

        Yields dicts shaped for the agent:
          {"type": "content", "delta": str}                    — text chunk
          {"type": "tool_call", "name": str, "args": str}      — finished tool call
          {"type": "tool_call_args", "id": str, "name": str, "args_delta": str}
                                                               — streaming args fragment
        With strict tool mode the model either streams tool-call JSON or
        content — never both in one response — so the channels are unambiguous.
        """
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            async with client.stream(
                "POST",
                GROQ_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
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
