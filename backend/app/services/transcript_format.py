"""Transcript formatting helpers.

Three concerns, kept separate from the PDF renderer so they are unit-testable:

1. ``build_interview_summary`` — a premium, recruiter-friendly executive
   summary (200-250 words) built from the stored LLM report fields. Each
   key finding is a bold-labeled paragraph (technical knowledge,
   communication, confidence, critical thinking, experience, problem
   solving, weak areas, overall impression) so the report reads like an HR
   executive summary, never like a transcript dump.

2. ``_clip_to_word_limit`` — sentence-preserving word budgeting used by
   the summary builder.

3. ``build_qa_pairs`` / ``format_qa_transcript`` — structured Question &
   Answer layout helpers. These remain available (and unit-testable) even
   though the generated PDF no longer embeds the full transcript.
"""
from __future__ import annotations

import re
from typing import Any

# --- Summary -----------------------------------------------------------------


def _word_count(text: str) -> int:
    return len((text or "").split())


def _clip_to_word_limit(text: str, max_words: int = 280) -> str:
    """Clip text to a soft word budget, preserving whole sentences."""
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    picked: list[str] = []
    total = 0
    for sentence in sentences:
        words = _word_count(sentence)
        if total + words > max_words:
            break
        picked.append(sentence)
        total += words
    result = " ".join(picked).strip()
    if not result and sentences:
        # First sentence alone exceeds the budget — keep a hard-trimmed prefix.
        result = text.strip()[: max_words * 6]
    return result


def _excerpt(text: str, max_words: int = 38) -> str:
    """Return the leading sentences of a report field, clipped to a budget."""
    return _clip_to_word_limit(text, max_words)


def build_interview_summary(report: dict[str, Any] | None, max_words: int = 240) -> list[tuple[str, str]]:
    """Build a premium executive summary from the stored report fields.

    Returns an ordered list of ``(label, text)`` findings. The label is
    rendered bold in the PDF, giving the "important findings highlighted"
    effect. Every finding is sourced from the LLM-written report sections —
    never copied from the transcript.

    The ``max_words`` budget is shared evenly across the available findings,
    so a fully-populated report lands in the ~200-250 word range while a
    sparse report simply produces a shorter (but never padded) summary.

    Sections map to the required coverage:
      - Main topics discussed  -> executive_summary / interview_overview
      - Technical knowledge    -> technical_assessment
      - Communication style    -> communication_assessment
      - Confidence level       -> confidence_assessment
      - Critical thinking      -> problem_solving_assessment
      - Relevant experience    -> experience_assessment
      - Problem solving        -> problem_solving_assessment
      - Weak areas             -> improvement_suggestions
      - Overall impression     -> executive_summary / performance_analysis
    """
    report = report or {}

    def _first_nonempty(*keys: str) -> str:
        for key in keys:
            value = (report.get(key) or "").strip()
            if value:
                return value
        return ""

    # Ordered findings — overall impression opens the summary, weak areas close it.
    candidates: list[tuple[str, str]] = [
        ("Overall Impression", _first_nonempty("executive_summary", "performance_analysis", "interview_overview")),
        ("Topics Discussed", _first_nonempty("interview_overview", "executive_summary")),
        ("Technical Knowledge", _first_nonempty("technical_assessment")),
        ("Communication Style", _first_nonempty("communication_assessment")),
        ("Confidence Level", _first_nonempty("confidence_assessment")),
        ("Critical Thinking & Problem Solving", _first_nonempty("problem_solving_assessment")),
        ("Relevant Experience", _first_nonempty("experience_assessment")),
        ("Areas for Improvement", _first_nonempty("improvement_suggestions")),
    ]
    findings = [(label, text) for label, text in candidates if text]
    if not findings:
        return [("Overall Impression", "Interview summary is not available for this evaluation.")]

    # Drop findings that fall back to the exact same text as an earlier one
    # (e.g. a sparse report whose only field is executive_summary), so the
    # summary never repeats a sentence under two different labels.
    seen: set[str] = set()
    unique: list[tuple[str, str]] = []
    for label, text in findings:
        if text not in seen:
            unique.append((label, text))
            seen.add(text)
    findings = unique

    # Share the word budget evenly so the whole summary stays near max_words.
    per_field = max(25, max_words // len(findings))
    excerpted = [(label, _excerpt(text, per_field)) for label, text in findings]

    # Hard cap: never exceed the budget, dropping the tail findings if needed.
    clipped: list[tuple[str, str]] = []
    used = 0
    for label, text in excerpted:
        words = _word_count(text)
        if used + words > max_words and clipped:
            break
        clipped.append((label, text))
        used += words
    return clipped or excerpted[:1]


# --- Structured Q&A transcript -------------------------------------------------


def _merge_turns(segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge consecutive segments from the same speaker into single turns.

    Keeps the earliest ``start`` and latest ``end`` so timestamps are
    preserved across the merged turn.
    """
    turns: list[dict[str, Any]] = []
    for seg in segments or []:
        text = (seg.get("text") or "").strip()
        if not text:
            continue
        speaker = seg.get("speaker")
        if turns and turns[-1]["speaker"] == speaker:
            turns[-1]["text"] = f"{turns[-1]['text']} {text}".strip()
            turns[-1]["end"] = seg.get("end", turns[-1].get("end"))
        else:
            turns.append(
                {
                    "speaker": speaker,
                    "text": text,
                    "start": seg.get("start"),
                    "end": seg.get("end"),
                }
            )
    return turns


def _pick_interviewer_speaker(turns: list[dict[str, Any]]) -> Any:
    """Heuristic: the speaker who says the least is the interviewer.

    Returns the speaker label (or None when there is only one speaker).
    """
    speakers: dict[Any, int] = {}
    for turn in turns:
        speaker = turn["speaker"]
        speakers[speaker] = speakers.get(speaker, 0) + _word_count(turn["text"])
    if len(speakers) < 2:
        return None
    return min(speakers, key=speakers.get)


def _fmt_ts(seconds) -> str:
    """Format a float timestamp as MM:SS (or H:MM:SS when over an hour)."""
    if seconds is None:
        return ""
    total = max(0, int(float(seconds)))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def build_qa_pairs(segments: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Group speaker turns into [{"question", "answer"}] pairs.

    An interviewer turn opens a new pair; every candidate turn that follows
    appends to that pair's answer. A candidate opening (interview started
    with the candidate speaking) produces a question-less entry. Timestamps
    are preserved per turn when the source segments provide them.
    """
    turns = _merge_turns(segments)
    if not turns:
        return []

    interviewer = _pick_interviewer_speaker(turns)
    if interviewer is None:
        # Single speaker — no structure to infer, return whole text as answer.
        full = " ".join(t["text"] for t in turns).strip()
        return [{"question": "", "answer": full}] if full else []

    pairs: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for turn in turns:
        if turn["speaker"] == interviewer:
            if current:
                pairs.append(current)
            current = {
                "question": turn["text"],
                "answer": "",
                "question_ts": _fmt_ts(turn.get("start")),
            }
        else:
            if current is None:
                current = {
                    "question": "",
                    "answer": turn["text"],
                    "question_ts": _fmt_ts(turn.get("start")),
                }
            else:
                current["answer"] = f"{current['answer']} {turn['text']}".strip()
                if not current.get("answer_ts"):
                    current["answer_ts"] = _fmt_ts(turn.get("start"))
    if current:
        pairs.append(current)
    return pairs


def format_qa_transcript(segments: list[dict[str, Any]]) -> str:
    """Render the transcript as readable 'Question N' blocks.

    Falls back to the raw joined text when speaker structure is missing.
    """
    pairs = build_qa_pairs(segments)
    if not pairs:
        return ""
    if len(pairs) == 1 and not pairs[0]["question"]:
        return pairs[0]["answer"]

    blocks: list[str] = []
    for index, pair in enumerate(pairs, start=1):
        block = [f"Question {index}"]
        if pair["question"]:
            q = pair["question"]
            if pair.get("question_ts"):
                q = f"[{pair['question_ts']}] {q}"
            block.append(f"Interviewer: {q}")
        if pair["answer"]:
            a = pair["answer"]
            if pair.get("answer_ts"):
                a = f"[{pair['answer_ts']}] {a}"
            block.append(f"Candidate: {a}")
        blocks.append("\n".join(block))
    return "\n\n".join(blocks)
