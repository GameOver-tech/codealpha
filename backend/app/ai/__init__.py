"""AI layer entry points — LLM provider factory + analysis services.

Re-exports the speech-to-text, speech analysis, sentiment analysis, and
evaluation entry points so callers can do ``from app.ai import ...``.

There is no mock mode: transcription always comes from Deepgram and the
evaluation always comes from a configured LLM provider.
"""
from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger
from app.utils.exceptions import BadRequestError

logger = get_logger(__name__)


def get_llm_provider():
    """Return a provider instance for the configured LLM_PROVIDER.

    Raises when the configured provider has no API key — evaluation must
    never run against fabricated content.
    """
    from app.ai.providers import (
        GeminiProvider,
        GroqProvider,
        OpenRouterProvider,
    )

    provider = settings.LLM_PROVIDER.lower()

    providers = {
        "openrouter": OpenRouterProvider,
        "gemini": GeminiProvider,
        "groq": GroqProvider,
    }

    if provider in providers:
        if providers[provider].has_credentials():
            return providers[provider]()
        raise BadRequestError(
            f"LLM_PROVIDER={provider} is configured but its API key is missing."
        )

    raise BadRequestError(
        f"Unknown LLM_PROVIDER={settings.LLM_PROVIDER!r}. "
        "Use one of: openrouter, gemini, groq."
    )


# Re-export analysis entry points (lazy imports keep import-time light).
def transcribe_audio(file_path: str):
    from app.ai.deepgram import transcribe_audio as _impl

    return _impl(file_path)


def analyze_speech(transcript: dict | None = None):
    from app.ai.speech_analysis import analyze_speech as _impl

    return _impl(transcript)


def analyze_sentiment(transcript: dict | None = None):
    from app.ai.sentiment_analysis import analyze_sentiment as _impl

    return _impl(transcript)
