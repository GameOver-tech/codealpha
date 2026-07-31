"""LLM provider implementations: OpenRouter, Gemini, Groq.

All providers implement the same ``complete()`` interface so the evaluation
pipeline is provider-agnostic. There is no mock provider — an LLM API key
is required.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.ai.base import LLMProvider, with_retries
from app.core.config import settings
from app.core.logging import get_logger
from app.utils.exceptions import BadRequestError

logger = get_logger(__name__)

DEFAULT_TIMEOUT = 120.0


class OpenRouterProvider(LLMProvider):
    name = "openrouter"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.OPENROUTER_API_KEY
        self.model = model or settings.OPENROUTER_MODEL

    @classmethod
    def has_credentials(cls) -> bool:
        return bool(settings.OPENROUTER_API_KEY)

    async def complete(self, prompt: str, *, max_tokens: int, temperature: float) -> str:
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        async def _call() -> str:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]

        return await with_retries(_call)


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL

    @classmethod
    def has_credentials(cls) -> bool:
        return bool(settings.GEMINI_API_KEY)

    async def complete(self, prompt: str, *, max_tokens: int, temperature: float) -> str:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature,
            },
        }

        async def _call() -> str:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                candidates = data.get("candidates") or []
                if not candidates:
                    raise BadRequestError(
                        f"Gemini returned no candidates: {data.get('promptFeedback')}"
                    )
                parts = candidates[0].get("content", {}).get("parts") or []
                return "".join(p.get("text", "") for p in parts)

        return await with_retries(_call)


class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_MODEL

    @classmethod
    def has_credentials(cls) -> bool:
        return bool(settings.GROQ_API_KEY)

    async def complete(self, prompt: str, *, max_tokens: int, temperature: float) -> str:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }

        async def _call() -> str:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]

        return await with_retries(_call)
