"""Tests for chat provider fallback: Groq 429 -> OpenRouter, and retry backoff."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest
import httpx

from app.ai.chat import groq_client
from app.ai.chat.groq_client import GroqChatProvider, _retryable


def test_retryable_status_codes():
    assert _retryable(429) is True
    assert _retryable(500) is True
    assert _retryable(502) is True
    assert _retryable(503) is True
    assert _retryable(400) is False
    assert _retryable(401) is False
    assert _retryable(404) is False


@pytest.mark.asyncio
async def test_stream_falls_back_to_openrouter_on_429(monkeypatch):
    """When Groq 429s, the client retries then transparently uses OpenRouter."""
    calls = []

    class FakeResp:
        def __init__(self, status_code):
            self.status_code = status_code
            self.url = "http://x"

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def raise_for_status(self):
            raise httpx.HTTPStatusError(
                "rate limited", request=httpx.Request("POST", "http://x"), response=self
            )

    class FakeStreamContext:
        def __init__(self, payload_holder):
            self.payload_holder = payload_holder

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            # Simulate a tool-calling streamed response.
            yield "data: {\"choices\": [{\"delta\": {\"tool_calls\": [{\"index\": 0, \"id\": \"call_1\", \"function\": {\"name\": \"get_dashboard_stats\", \"arguments\": \"{}\"}}]}, \"finish_reason\": null}]}"
            yield "data: {\"choices\": [{\"delta\": {}, \"finish_reason\": \"tool_calls\"}]}"
            yield "data: [DONE]"

    def fake_stream(*args, **kwargs):
        url = args[1]
        calls.append((url, kwargs.get("json")))
        if url == groq_client.GROQ_CHAT_URL:
            return FakeResp(429)
        return FakeStreamContext(kwargs.get("json"))

    monkeypatch.setattr(groq_client._get_client(), "stream", fake_stream)
    # Ensure OpenRouter is configured.
    monkeypatch.setattr(groq_client.settings, "OPENROUTER_API_KEY", "or-test-key", raising=False)

    provider = GroqChatProvider(api_key="g-test-key", model="groq-test-model")
    events = []
    async for ev in provider.stream([{"role": "user", "content": "hi"}], tools=[]):
        events.append(ev)

    # Groq attempted (with retries) then OpenRouter succeeded.
    urls = [u for u, _ in calls]
    assert urls.count(groq_client.GROQ_CHAT_URL) >= 1
    assert groq_client.OPENROUTER_CHAT_URL in urls
    tool_calls = [e for e in events if e["type"] == "tool_call"]
    assert tool_calls, "expected a tool_call event from the fallback provider"
    assert tool_calls[0]["name"] == "get_dashboard_stats"


@pytest.mark.asyncio
async def test_stream_no_fallback_when_openrouter_missing(monkeypatch):
    """Without an OpenRouter key, the 429 propagates after retries."""
    calls = []

    class FakeResp:
        def __init__(self, status_code):
            self.status_code = status_code
            self.url = "http://x"

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def raise_for_status(self):
            raise httpx.HTTPStatusError(
                "rate limited", request=httpx.Request("POST", "http://x"), response=self
            )

    def fake_stream(*args, **kwargs):
        url = args[1]
        calls.append(url)
        return FakeResp(429)

    monkeypatch.setattr(groq_client._get_client(), "stream", fake_stream)
    monkeypatch.setattr(groq_client.settings, "OPENROUTER_API_KEY", "", raising=False)

    provider = GroqChatProvider(api_key="g-test-key", model="groq-test-model")
    with pytest.raises(httpx.HTTPStatusError):
        async for _ in provider.stream([{"role": "user", "content": "hi"}]):
            pass

    # Groq was retried MAX_429_RETRIES + 1 times, no fallback attempted.
    assert calls.count(groq_client.GROQ_CHAT_URL) == groq_client.MAX_429_RETRIES + 1
