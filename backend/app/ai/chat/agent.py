"""ChatAgent — orchestrates the Groq tool-calling loop for one chat turn.

Stateless: the client sends the recent message history with each request.
Flow per user message:
1. Build messages (system + client-provided history window).
2. Stream a completion from Groq; forward content deltas to the caller.
3. If the model emits tool calls, execute them (concurrently when independent)
   against live database data, append role="tool" results, and loop.
4. Stop when the model produces a plain text answer or the turn cap is hit.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.chat.groq_client import GroqChatProvider
from app.ai.chat.system_prompt import build_system_prompt
from app.ai.chat.tool_router import execute_tool, get_groq_tools
from app.core.config import settings
from app.core.logging import get_logger
from app.models.user import User

logger = get_logger(__name__)


class ChatAgent:
    def __init__(self, db: AsyncSession, actor: User):
        self.db = db
        self.actor = actor
        self.provider = GroqChatProvider()
        self.tools = get_groq_tools(actor.role.value)
        self.system_prompt = build_system_prompt(actor)

    def _history(self, prior_messages: list[dict]) -> list[dict]:
        """Messages sent to Groq: system prompt + bounded client history."""
        messages: list[dict] = [{"role": "system", "content": self.system_prompt}]
        window = [
            m for m in prior_messages
            if m.get("role") in ("user", "assistant") and m.get("content")
        ]
        messages.extend(window[-settings.CHAT_MAX_MESSAGES:])
        return messages

    async def run(
        self,
        user_message: str,
        prior_messages: list[dict],
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream one assistant turn. Yields events for the SSE response.

        Events:
          {"type": "delta", "content": str}       — text chunk
          {"type": "tool_start", "name": str}
          {"type": "tool_done", "name": str}
          {"type": "tool_error", "name": str, "error": str}
          {"type": "done", "content": str}        — final accumulated text
        """
        messages = self._history(prior_messages)
        messages.append({"role": "user", "content": user_message})

        full_text = ""
        turns = 0

        while turns < settings.CHAT_MAX_TURNS:
            turns += 1
            tool_calls: list[dict] = []
            async for event in self.provider.stream(messages, self.tools):
                if event["type"] == "content":
                    full_text += event["delta"]
                    yield {"type": "delta", "content": event["delta"]}
                elif event["type"] == "tool_call":
                    tool_calls.append(event)

            if not tool_calls:
                break

            # Assistant message carrying the tool calls must be appended before
            # the tool results (OpenAI-compatible protocol requirement).
            messages.append(
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": tc["args"] or "{}",
                            },
                        }
                        for tc in tool_calls
                    ],
                }
            )

            # Execute independent tool calls concurrently.
            async def _run_tool(tc: dict) -> tuple[dict, dict | None, str | None]:
                try:
                    args = json.loads(tc["args"] or "{}")
                except json.JSONDecodeError:
                    args = {}
                try:
                    result = await execute_tool(
                        self.db, self.actor, self.actor.role.value, tc["name"], args
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Tool %s failed: %s", tc["name"], exc)
                    return tc, None, str(exc)
                return tc, result, None

            # Independent handlers share the session but touch their own rows.
            outcomes = await asyncio.gather(*[_run_tool(tc) for tc in tool_calls])

            for tc, result, error in outcomes:
                name = tc["name"]
                if error is not None:
                    yield {"type": "tool_error", "name": name, "error": error}
                    content = {"error": error}
                else:
                    yield {"type": "tool_done", "name": name}
                    content = {"result": result}
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(content, default=str),
                    }
                )

        yield {"type": "done", "content": full_text}
