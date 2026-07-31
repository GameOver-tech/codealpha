"""Professional PDF report generator (ReportLab).

Generates a recruiter-friendly, ATS-readable corporate PDF with the
HireLens AI branding, all evaluation sections, a final score table, and a
color-coded hiring recommendation badge.
"""
from __future__ import annotations

import enum
import io
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.config import settings
from app.core.logging import get_logger
from app.services.transcript_format import build_interview_summary
from app.storage import copy_local_to_supabase, cleanup_local_file
from app.utils.exceptions import BadRequestError

logger = get_logger(__name__)

BRAND_COLOR = colors.HexColor("#1B2A4A")       # deep navy
ACCENT_COLOR = colors.HexColor("#2E7CF6")      # electric blue
LIGHT_BG = colors.HexColor("#F4F7FB")
TEXT_COLOR = colors.HexColor("#2A2F3A")
MUTED_COLOR = colors.HexColor("#5A6472")

VERDICT_COLORS = {
    "Recommended": colors.HexColor("#1B9E5A"),        # green
    "Need Further Review": colors.HexColor("#E5A51B"),  # yellow/amber
    "Not Recommended": colors.HexColor("#D64545"),     # red
}

FONT_DIRS = [
    Path("/usr/share/fonts/truetype/dejavu"),
    Path("C:/Windows/Fonts"),
]

REGULAR_FONT = "Helvetica"
BOLD_FONT = "Helvetica-Bold"
MONO_FONT = "Courier"


def _register_fonts() -> None:
    """Register DejaVu fonts if present (nicer typography); fall back to Helvetica."""
    global REGULAR_FONT, BOLD_FONT
    for d in FONT_DIRS:
        regular = d / "DejaVuSans.ttf"
        bold = d / "DejaVuSans-Bold.ttf"
        if regular.exists() and bold.exists():
            try:
                pdfmetrics.registerFont(TTFont("DejaVu", str(regular)))
                pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(bold)))
                REGULAR_FONT = "DejaVu"
                BOLD_FONT = "DejaVu-Bold"
                return
            except Exception:  # noqa: BLE001
                pass
    logger.info("DejaVu fonts not found — using Helvetica for PDF output")


class _Styles:
    """Pre-built paragraph styles for the report."""

    def __init__(self) -> None:
        base = getSampleStyleSheet()
        self.title = ParagraphStyle(
            "BrandTitle", parent=base["Title"], fontName=BOLD_FONT,
            fontSize=26, leading=32, textColor=BRAND_COLOR,
            alignment=TA_CENTER, spaceAfter=2,
        )
        self.subtitle = ParagraphStyle(
            "Subtitle", parent=base["Normal"], fontName=REGULAR_FONT,
            fontSize=11, leading=15, textColor=MUTED_COLOR, alignment=TA_CENTER,
        )
        self.h1 = ParagraphStyle(
            "SectionHeading", parent=base["Heading2"], fontName=BOLD_FONT,
            fontSize=14, leading=18, textColor=BRAND_COLOR,
            spaceBefore=14, spaceAfter=6,
        )
        self.body = ParagraphStyle(
            "Body", parent=base["Normal"], fontName=REGULAR_FONT,
            fontSize=10.5, leading=15.5, textColor=TEXT_COLOR,
            alignment=TA_LEFT, spaceAfter=4,
        )
        self.bullet = ParagraphStyle(
            "Bullet", parent=self.body, leftIndent=14, bulletIndent=2,
            spaceAfter=3,
        )
        self.small = ParagraphStyle(
            "Small", parent=self.body, fontSize=8.5, leading=11, textColor=MUTED_COLOR,
        )
        self.meta_label = ParagraphStyle(
            "MetaLabel", parent=self.body, fontSize=8.5, textColor=MUTED_COLOR,
            spaceAfter=1,
        )
        self.meta_value = ParagraphStyle(
            "MetaValue", parent=self.body, fontSize=11.5, textColor=TEXT_COLOR,
            spaceAfter=8, fontName=BOLD_FONT,
        )


def _safe(text: Any) -> str:
    """Coerce arbitrary values to clean text for the PDF.

    Enum objects are normalized to their human-readable ``.value`` (never
    their Python class name, e.g. ``RecommendationVerdict.RECOMMENDED``).
    """
    if text is None:
        value = ""
    elif isinstance(text, enum.Enum):
        value = text.value if text.value is not None else ""
    else:
        value = str(text)
    value = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return value.strip()


def _format_duration(seconds: int) -> str:
    seconds = int(seconds or 0)
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}h {m:02d}m {s:02d}s"
    return f"{m}m {s:02d}s"


def _duration_from_segments(segments: list[Any] | None) -> int:
    """Return the last transcript segment's end time (the interview duration).

    The transcription timestamps are the authoritative source for how long
    the interview actually ran. Returns 0 when there are no usable timestamps
    so callers can fall back to media metadata.
    """
    for segment in reversed(segments or []):
        if not isinstance(segment, dict):
            continue
        try:
            end = float(segment.get("end") or 0)
        except (TypeError, ValueError):
            continue
        if end > 0:
            return int(round(end))
    return 0


def _duration_from_raw(raw_response: Any) -> int:
    """Extract the media duration from Deepgram's stored raw response."""
    try:
        if not isinstance(raw_response, dict):
            return 0
        metadata = raw_response.get("metadata") or {}
        duration = float(metadata.get("duration") or 0)
        return int(round(duration)) if duration > 0 else 0
    except (TypeError, ValueError, AttributeError):
        return 0


def _format_date(dt) -> str:
    if not dt:
        return "—"
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except ValueError:
            return dt
    return dt.strftime("%B %d, %Y")


def _parse_lines(text: Any) -> list[str]:
    """Split a paragraph into bullet lines when it contains list markers."""
    value = _safe(text)
    lines = [ln.strip() for ln in value.splitlines() if ln.strip()]
    if not lines:
        return [value] if value else []
    # Rejoin wrapped single paragraphs.
    if len(lines) == 1:
        return lines
    # If lines look like a list (start with numbers/dashes), keep them.
    if any(re.match(r"^[\d\-•*.)]\s*", ln) for ln in lines):
        return lines
    return [value]


def _build_strengths_weaknesses_section(
    items: list[Any], title: str
) -> list[Any]:
    """Build a strengths/weaknesses section with bullet flowables."""
    flow: list[Any] = [Paragraph(title, styles.h1)]
    if not items:
        flow.append(Paragraph("No items recorded.", styles.body))
        return flow
    for item in items:
        text = _safe(item).strip(" -•*\t")
        if text:
            flow.append(Paragraph(f"•&nbsp;{text}", styles.bullet))
    return flow


styles = _Styles()


def _draw_header_footer(canvas_obj: canvas.Canvas, doc: Any) -> None:
    """Draw the branded header and footer on every page."""
    width, height = A4
    # Header band
    canvas_obj.saveState()
    canvas_obj.setFillColor(BRAND_COLOR)
    canvas_obj.rect(0, height - 0.55 * inch, width, 0.55 * inch, stroke=0, fill=1)
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont(BOLD_FONT, 10)
    canvas_obj.drawString(0.6 * inch, height - 0.38 * inch, "HireLens AI")
    canvas_obj.setFont(REGULAR_FONT, 7.5)
    canvas_obj.drawRightString(width - 0.6 * inch, height - 0.38 * inch,
                               "AI Assisted Interview Evaluation")
    # Accent line
    canvas_obj.setFillColor(ACCENT_COLOR)
    canvas_obj.rect(0, height - 0.6 * inch, width, 0.05 * inch, stroke=0, fill=1)
    # Footer
    canvas_obj.setFillColor(MUTED_COLOR)
    canvas_obj.setFont(REGULAR_FONT, 8)
    canvas_obj.drawString(0.6 * inch, 0.45 * inch, "Generated by HireLens AI")
    canvas_obj.setFont(REGULAR_FONT, 7.5)
    canvas_obj.drawRightString(width - 0.6 * inch, 0.45 * inch,
                               f"Page {canvas_obj.getPageNumber()}")
    canvas_obj.drawCentredString(width / 2, 0.30 * inch,
                                 f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    canvas_obj.restoreState()


def _build_story(payload: dict[str, Any]) -> list[Any]:
    """Assemble the full PDF document story."""
    cand_name = _safe(payload.get("candidate_name")) or "Candidate"
    cand_email = _safe(payload.get("candidate_email")) or "—"
    interview_date = payload.get("interview_date")
    # Show "Unknown" only when every duration source is unavailable — never a
    # fabricated 0m 00s (a real interview is never literally zero seconds).
    duration_raw = int(payload.get("duration_seconds") or 0)
    duration_label = _format_duration(duration_raw) if duration_raw > 0 else "Unknown"
    scores = payload.get("scores") or {}
    verdict = _safe(payload.get("recommendation")) or "—"
    overall = scores.get("overall_score", 0)
    report = payload.get("report") or {}
    strengths = payload.get("strengths") or []
    weaknesses = payload.get("weaknesses") or []

    story: list[Any] = []

    # ---- Title block ----
    story.append(Spacer(1, 0.25 * inch))
    story.append(Paragraph("HireLens AI", styles.title))
    story.append(Paragraph("AI Interview Evaluation Report", styles.subtitle))
    story.append(Spacer(1, 0.15 * inch))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT_COLOR))
    story.append(Spacer(1, 0.15 * inch))

    # ---- Candidate meta + recommendation badge ----
    meta = [
        ["Candidate Name", cand_name],
        ["Candidate Email", cand_email],
        ["Job Position", _safe(payload.get("job_title")) or "—"],
        ["Interview Date", _format_date(interview_date)],
        ["Interview Duration", duration_label],
    ]
    meta_table = Table(meta, colWidths=[1.7 * inch, 4.6 * inch])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), BOLD_FONT),
        ("FONTSIZE", (0, 0), (0, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED_COLOR),
        ("FONTNAME", (1, 0), (1, -1), REGULAR_FONT),
        ("FONTSIZE", (1, 0), (1, -1), 11),
        ("TEXTCOLOR", (1, 0), (1, -1), TEXT_COLOR),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(meta_table)

    verdict_color = VERDICT_COLORS.get(verdict, MUTED_COLOR)
    badge_text = f"Overall Score: <b>{_safe(overall)}/100</b>&nbsp;&nbsp;|&nbsp;&nbsp;Recommendation: <b>{_safe(verdict)}</b>"
    badge = Table([[Paragraph(badge_text, ParagraphStyle(
        "Badge", parent=styles.body, fontName=BOLD_FONT, fontSize=11.5,
        textColor=colors.white, alignment=TA_CENTER, leading=16,
    ))]], colWidths=[6.3 * inch])
    badge.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), verdict_color),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 0.12 * inch))
    story.append(badge)
    story.append(Spacer(1, 0.1 * inch))

    # ---- Section 1: Executive Summary ----
    story.append(Paragraph("1. Executive Summary", styles.h1))
    story.append(Paragraph(_safe(report.get("executive_summary")) or "No summary available.", styles.body))

    # ---- Section 2: Candidate Overview ----
    story.append(Paragraph("2. Candidate Overview", styles.h1))
    story.append(Paragraph(_safe(report.get("candidate_overview")) or "No candidate overview available.", styles.body))

    # ---- Section 3: Interview Summary (premium executive summary) ----
    story.append(Paragraph("3. Interview Summary", styles.h1))
    summary_style = ParagraphStyle(
        "SummaryBody", parent=styles.body, spaceAfter=5,
    )
    for label, text in build_interview_summary(report):
        story.append(
            Paragraph(f"<b>{_safe(label)}:</b>&nbsp;{_safe(text)}", summary_style)
        )

    # ---- Sections 4-8: Evaluations ----
    section_map = [
        ("4. Technical Evaluation", "technical_assessment"),
        ("5. Communication Evaluation", "communication_assessment"),
        ("6. Confidence Analysis", "confidence_assessment"),
        ("7. Problem Solving Evaluation", "problem_solving_assessment"),
        ("8. Relevant Experience", "experience_assessment"),
    ]
    for title, key in section_map:
        story.append(Paragraph(title, styles.h1))
        story.append(Paragraph(_safe(report.get(key)) or "Not assessed.", styles.body))

    # ---- Sections 9-10: Strengths / Weaknesses ----
    story.extend(_build_strengths_weaknesses_section(strengths, "9. Strengths"))
    story.extend(_build_strengths_weaknesses_section(weaknesses, "10. Weaknesses"))

    # ---- Section 11: Improvement Suggestions ----
    story.append(Paragraph("11. Improvement Suggestions", styles.h1))
    suggestions = _parse_lines(report.get("improvement_suggestions"))
    if suggestions:
        for line in suggestions:
            story.append(Paragraph(f"•&nbsp;{_safe(line).lstrip('0123456789.-)• ')}", styles.bullet))
    else:
        story.append(Paragraph("No suggestions recorded.", styles.body))

    # ---- Section 12: Final Score Table ----
    story.append(PageBreak())
    story.append(Paragraph("12. Final Score Table", styles.h1))

    score_labels = [
        ("Technical", "technical_skills"),
        ("Communication", "communication"),
        ("Confidence", "confidence"),
        ("Problem Solving", "problem_solving"),
        ("Experience", "relevant_experience"),
        ("Leadership", "leadership"),
        ("Critical Thinking", "critical_thinking"),
        ("Professionalism", "professionalism"),
    ]
    score_rows = [["Dimension", "Score"]] + [
        [label, f"{_safe(scores.get(key, 0))}/100"] for label, key in score_labels
    ]
    score_table = Table(score_rows, colWidths=[4.6 * inch, 1.7 * inch])
    score_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), BOLD_FONT),
        ("FONTNAME", (0, 1), (0, -1), REGULAR_FONT),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT_COLOR),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DCE5")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(score_table)

    story.append(Spacer(1, 0.15 * inch))
    overall_row = Table(
        [[Paragraph(f"Overall Score: <b>{_safe(overall)}/100</b>", ParagraphStyle(
            "Overall", parent=styles.body, fontName=BOLD_FONT, fontSize=13,
            textColor=BRAND_COLOR, alignment=TA_CENTER))]],
        colWidths=[6.3 * inch],
    )
    overall_row.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(overall_row)

    # ---- Section 13: Hiring Recommendation ----
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph("13. Hiring Recommendation", styles.h1))
    rec_color = VERDICT_COLORS.get(verdict, MUTED_COLOR)
    rec_text = f"<b>{_safe(verdict)}</b>"
    rec_table = Table([[Paragraph(rec_text, ParagraphStyle(
        "Rec", parent=styles.body, fontName=BOLD_FONT, fontSize=15,
        textColor=colors.white, alignment=TA_CENTER, leading=20,
    ))]], colWidths=[6.3 * inch])
    rec_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), rec_color),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(rec_table)

    reason = _safe(payload.get("recommendation_reason"))
    if reason:
        story.append(Spacer(1, 0.1 * inch))
        story.append(Paragraph(reason, styles.body))

    return story


def _build_pdf_bytes(payload: dict[str, Any]) -> bytes:
    """Render the story to in-memory PDF bytes."""
    _register_fonts()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.65 * inch,
        title="HireLens AI — Interview Evaluation Report",
        author="HireLens AI",
    )
    story = _build_story(payload)
    doc.build(story, onFirstPage=_draw_header_footer, onLaterPages=_draw_header_footer)
    return buffer.getvalue()


def _build_payload(interview, *, transcript_text: str = "") -> dict[str, Any]:
    """Assemble the PDF payload from a fully-loaded interview object."""
    user = interview.candidate

    scores = interview.scores
    report = interview.report
    strengths = [s.text for s in interview.strengths]
    weaknesses = [w.text for w in interview.weaknesses]
    # Normalize the verdict to its human-readable string value. The DB column
    # yields a RecommendationVerdict enum, and str() of a str-based enum
    # produces "RecommendationVerdict.RECOMMENDED" — never expose that to users.
    verdict = "—"
    if interview.recommendation:
        raw = interview.recommendation.verdict
        verdict = raw.value if hasattr(raw, "value") else str(raw)
    reason = interview.recommendation.reason if interview.recommendation else ""

    # Structured transcript — segments drive the Q&A layout, full_text is
    # the fallback when speaker diarization is unavailable.
    transcript = interview.transcript
    transcript_payload: dict[str, Any] = {
        "full_text": transcript_text or (transcript.full_text if transcript else ""),
        "segments": transcript.segments if transcript else [],
    }

    # Interview duration: prefer the transcription timestamps (last segment's
    # end time), then the media duration stored at upload, then Deepgram's
    # reported duration. Only when every source is missing do we show
    # "Unknown" — never a fabricated 0m 00s.
    duration = _duration_from_segments(transcript.segments if transcript else None)
    if not duration:
        duration = int(interview.duration_seconds or 0)
    if not duration:
        duration = int(getattr(transcript, "raw_response", None) and _duration_from_raw(transcript.raw_response) or 0)

    report_payload = {
        "executive_summary": report.executive_summary if report else "",
        "interview_overview": report.interview_overview if report else "",
        "candidate_overview": report.candidate_overview if report else "",
        "performance_analysis": report.performance_analysis if report else "",
        "technical_assessment": report.technical_assessment if report else "",
        "communication_assessment": report.communication_assessment if report else "",
        "confidence_assessment": report.confidence_assessment if report else "",
        "problem_solving_assessment": report.problem_solving_assessment if report else "",
        "experience_assessment": report.experience_assessment if report else "",
        "improvement_suggestions": report.improvement_suggestions if report else "",
    }

    return {
        "candidate_name": user.full_name if user else "Candidate",
        "candidate_email": user.email if user else "—",
        "job_title": interview.job_title,
        "interview_date": interview.created_at,
        "duration_seconds": duration,
        "overall_score": scores.overall_score if scores else 0,
        "recommendation": verdict,
        "recommendation_reason": reason,
        "transcript": transcript_payload,
        "scores": scores.score_map if scores else {},
        "report": report_payload,
        "strengths": strengths,
        "weaknesses": weaknesses,
    }


async def generate_pdf_ondemand(db, interview_id) -> tuple[bytes, str]:
    """Generate a professional PDF in memory from stored interview results.

    Used by the admin 'Generate PDF' / 'Regenerate PDF' actions. Reads ONLY
    already-persisted data (transcript, scores, recommendation, report,
    strengths, weaknesses) — never calls Deepgram or the LLM, never writes
    the PDF to disk, never stores it. Returns (pdf_bytes, filename).
    """
    from app.repositories.interview import InterviewRepository

    interviews = InterviewRepository(db)
    interview = await interviews.get_for_pdf(interview_id)
    if interview is None:
        raise BadRequestError(f"Interview {interview_id} not found")

    payload = _build_payload(interview)
    pdf_bytes = await _generate_pdf_bytes_async(payload)
    filename = f"HireLens-Report-{_safe(payload['candidate_name']).replace(' ', '-')}.pdf"
    return pdf_bytes, filename


async def generate_interview_pdf(db, interview_id, *, generated_by: str = "") -> dict[str, Any]:
    """Generate, store and persist metadata for an interview's PDF report.

    Returns {"filename", "storage_path", "file_size_bytes"}.
    """
    import asyncio

    from app.repositories.interview import InterviewRepository
    from app.repositories.interview_file import ActivityLogRepository

    interviews = InterviewRepository(db)
    interview = await interviews.get_for_pdf(interview_id)
    if interview is None:
        raise BadRequestError(f"Interview {interview_id} not found")

    payload = _build_payload(interview)
    pdf_bytes = await _generate_pdf_bytes_async(payload)

    filename = f"interview_report_{str(interview_id)[:8]}.pdf"
    storage_path = f"reports/{interview_id}/{filename}"

    # Save locally first, then sync to Supabase Storage if configured. The
    # disk write + network upload are offloaded to a worker thread so the
    # event loop never blocks during PDF generation.
    local_dir = Path(settings.GENERATED_DIR) / "reports" / str(interview_id)

    def _persist_local() -> tuple[Path, Path]:
        local_dir.mkdir(parents=True, exist_ok=True)
        local_path = local_dir / filename
        local_path.write_bytes(pdf_bytes)
        return local_dir, local_path

    _, local_path = await asyncio.to_thread(_persist_local)

    remote_path = storage_path
    synced = False
    try:
        remote_path = await asyncio.to_thread(
            copy_local_to_supabase, str(local_path), storage_path
        )
        synced = True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Supabase storage sync failed for %s: %s", filename, exc)

    # Record metadata.
    from app.models.generated_pdf import GeneratedPdf

    pdf_record = GeneratedPdf(
        interview_id=interview_id,
        filename=filename,
        storage_path=remote_path,
        file_size_bytes=len(pdf_bytes),
        generated_at=datetime.now(timezone.utc),
        generated_by=generated_by or "system",
    )
    db.add(pdf_record)
    await db.commit()

    # Only remove the local copy when the remote sync succeeded; otherwise
    # keep the local file so the PDF remains downloadable.
    if synced:
        await asyncio.to_thread(cleanup_local_file, str(local_path))

    return {
        "filename": filename,
        "storage_path": remote_path,
        "file_size_bytes": len(pdf_bytes),
    }


async def _generate_pdf_bytes_async(payload: dict[str, Any]) -> bytes:
    """Render the PDF in a worker thread so the event loop stays free."""
    import asyncio

    return await asyncio.to_thread(_build_pdf_bytes, payload)
