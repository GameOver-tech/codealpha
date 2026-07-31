"""AI layer entry points — LLM provider factory + analysis services.

Re-exports the speech-to-text, speech analysis, sentiment analysis, and
evaluation entry points so callers can do ``from app.ai import ...``.
"""
from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def get_llm_provider():
    """Return a provider instance for the configured LLM_PROVIDER.

    Falls back to OpenRouter when the requested provider is missing a key
    and another provider is configured, so the pipeline keeps working.
    """
    from app.ai.providers import (
        GeminiProvider,
        GroqProvider,
        OpenRouterProvider,
        MockProvider,
    )

    provider = settings.LLM_PROVIDER.lower()
    if settings.USE_MOCK_AI:
        logger.info("Mock mode enabled — using MockProvider")
        return MockProvider()

    providers = {
        "openrouter": OpenRouterProvider,
        "gemini": GeminiProvider,
        "groq": GroqProvider,
    }

    if provider in providers:
        if providers[provider].has_credentials():
            return providers[provider]()

    # Fall back to the first provider with credentials.
    for name, cls in providers.items():
        if name != provider and cls.has_credentials():
            logger.warning(
                "LLM_PROVIDER=%s has no key configured — falling back to %s",
                provider,
                name,
            )
            return cls()

    logger.warning("No LLM API key configured — using MockProvider")
    return MockProvider()


# Re-export analysis entry points (lazy imports keep import-time light).
def transcribe_audio(file_path: str):
    from app.ai.deepgram import transcribe_audio as _impl

    return _impl(file_path)


def analyze_speech(transcript: dict | None = None, *, mock: bool = False):
    from app.ai.speech_analysis import analyze_speech as _impl

    return _impl(transcript, mock=mock)


def analyze_sentiment(transcript: dict | None = None, *, mock: bool = False):
    from app.ai.sentiment_analysis import analyze_sentiment as _impl

    return _impl(transcript, mock=mock)
