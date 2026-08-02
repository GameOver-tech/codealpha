"""Email service — sends interview result emails via SMTP.

SMTP is configured through environment variables (see Settings). When
EMAIL_ENABLED is false or SMTP_HOST is empty, send_result_email falls back
to returning a queued-style response so the chat tool can still confirm the
intent without failing (useful during development).
"""
from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def send_result_email(
    to_email: str,
    candidate_name: str,
    job_title: str,
    status: str,
    verdict: str,
    message: str,
) -> dict:
    """Send the candidate's interview result email.

    Returns a dict describing the outcome: {"status": "sent" | "queued",
    "email": ..., "detail": ...}. Never raises — callers surface the detail
    string to the user.
    """
    if not settings.EMAIL_ENABLED or not settings.SMTP_HOST:
        return {
            "status": "queued",
            "email": to_email,
            "detail": (
                "Email delivery is not configured yet (SMTP settings missing). "
                "The result is ready and can be shared manually."
            ),
        }

    verdict_line = verdict or "No verdict yet"
    subject = f"Your interview result — {job_title}"

    body = (
        f"Hello {candidate_name or 'there'},\n\n"
        f"Here are the results of your AI interview for the **{job_title}** position:\n\n"
        f"Status: {status}\n"
        f"Recommendation: {verdict_line}\n\n"
        f"{message}\n\n"
        f"Best regards,\nHireLens AI Team"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.set_content(body)

    try:
        if settings.SMTP_USE_TLS:
            context = ssl.create_default_context()
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
                server.starttls(context=context)
                if settings.SMTP_USERNAME:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
                if settings.SMTP_USERNAME:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to send result email to %s", to_email)
        return {
            "status": "error",
            "email": to_email,
            "detail": f"Email could not be sent: {exc}",
        }

    logger.info("Result email sent to %s", to_email)
    return {
        "status": "sent",
        "email": to_email,
        "detail": "Email sent successfully.",
    }
