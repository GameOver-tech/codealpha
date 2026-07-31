"""Transcript formatting helpers.

Two concerns, kept separate from the PDF renderer so they are unit-testable:

1. ``build_interview_summary`` — a concise (150-300 word) professional
   overview built from the stored LLM report fields. It NEVER returns the
   raw transcript, so the "Transcript Summary" section of the PDF can never
   accidentally contain the full interview conversation.

2. ``build_qa_pairs`` / ``format_qa_transcript`` — group timestamped,
   speaker-annotated segments into a structured Question & Answer layout
   (Interviewer question immediately followed by the Candidate answer).

The interviewer/candidate split uses a word-count heuristic: in an
interview the candidate talks substantially more than the interviewer, so
the speaker with the fewest total words is treated as the interviewer.
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


def build_interview_summary(report: dict[str, Any] | None, max_words: int = 280) -> str:
    """Build a concise professional summary from the stored report fields.

    Priority order: executive_summary + performance_analysis, then
    interview_overview, then performance_analysis alone. These are LLM-
    written overviews — never the transcript. Falls back to a deterministic
    overview line when the report is empty.
    """
    report = report or {}
    candidates = [
        report.get("executive_summary") or "",
        report.get("performance_analysis") or "",
        report.get("interview_overview") or "",
    ]
    parts = [p.strip() for p in candidates if p.strip()]
    if parts:
        return _clip_to_word_limit(" ".join(parts), max_words)
    return "Interview summary is not available for this evaluation."


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
