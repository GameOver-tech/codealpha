"""Structured logging setup for the application."""
import logging
import sys
from typing import Any

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logging with a console handler."""
    root = logging.getLogger()
    root.setLevel(level)

    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT))
        root.addHandler(handler)

    # Quiet noisy third-party loggers
    for name in ("uvicorn.access", "httpx", "httpcore", "asyncio"):
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a module-level logger."""
    return logging.getLogger(name)


def log_exception(logger: logging.Logger, exc: Any, context: str = "") -> None:
    """Log an exception with optional context, without re-raising."""
    logger.exception("%s: %s", context or "Unhandled error", exc)
