"""
Seed realistic dummy data for the admin panel.

Creates candidate accounts (in the `users` table, NOT Supabase Auth — these
are display-only) plus completed interviews with full evaluation artifacts:
scores, transcript, speech/sentiment analysis, strengths, weaknesses,
recommendation, and report.

Usage (from repo root):
    python -m backend.seed_dummy
    # or, from backend/:
    python -m seed_dummy

Idempotent — safe to run repeatedly. Existing candidates are skipped.
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure `backend` is importable regardless of CWD.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import select  # noqa: E402

from app.core.database import AsyncSessionLocal, engine  # noqa: E402
from app.models.candidate_profile import CandidateProfile  # noqa: E402
from app.models.interview import Interview, InterviewStatus  # noqa: E402
from app.models.interview_report import InterviewReport  # noqa: E402
from app.models.interview_scores import InterviewScores  # noqa: E402
from app.models.recommendation import Recommendation, RecommendationVerdict  # noqa: E402
from app.models.sentiment_analysis import SentimentAnalysis  # noqa: E402
from app.models.speech_analysis import SpeechAnalysis  # noqa: E402
from app.models.strength import Strength, Weakness  # noqa: E402
from app.models.transcript import Transcript  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# (email, first, last, phone, gender, job, experience_years, company)
CANDIDATES = [
    ("ahmed.khan@example.com", "Ahmed", "Khan", "+92 300 1112233", "Male",
     "Senior Python Developer", 6, "TechNova Solutions"),
    ("sara.ali@example.com", "Sara", "Ali", "+92 321 4445566", "Female",
     "Frontend Engineer", 4, "WebCraft Studio"),
    ("usman.malik@example.com", "Usman", "Malik", "+92 333 7778899", "Male",
     "DevOps Engineer", 5, "CloudScale Systems"),
    ("aisha.siddiqui@example.com", "Aisha", "Siddiqui", "+92 345 1234567", "Female",
     "Data Scientist", 3, "DataMinds AI"),
    ("bilal.hussain@example.com", "Bilal", "Hussain", "+92 301 9876543", "Male",
     "Full Stack Developer", 2, "StartupHub"),
    ("mahnoor.fatima@example.com", "Mahnoor", "Fatima", "+92 310 5554433", "Female",
     "Product Manager", 7, "Innovate Labs"),
]

# Interview metadata per candidate: (job_title, status, scores, verdict, days_ago)
INTERVIEWS = {
    "ahmed.khan@example.com": [
        ("Senior Python Developer",
         {"technical_skills": 88, "communication": 82, "confidence": 79, "problem_solving": 90,
          "relevant_experience": 85, "leadership": 70, "teamwork": 78, "critical_thinking": 86,
          "behavior": 84, "professionalism": 87},
         RecommendationVerdict.RECOMMENDED, 12),
        ("Senior Python Developer",
         {"technical_skills": 92, "communication": 85, "confidence": 83, "problem_solving": 94,
          "relevant_experience": 88, "leadership": 74, "teamwork": 80, "critical_thinking": 90,
          "behavior": 86, "professionalism": 89},
         RecommendationVerdict.RECOMMENDED, 3),
    ],
    "sara.ali@example.com": [
        ("Frontend Engineer",
         {"technical_skills": 78, "communication": 91, "confidence": 88, "problem_solving": 80,
          "relevant_experience": 75, "leadership": 72, "teamwork": 90, "critical_thinking": 76,
          "behavior": 92, "professionalism": 90},
         RecommendationVerdict.RECOMMENDED, 9),
    ],
    "usman.malik@example.com": [
        ("DevOps Engineer",
         {"technical_skills": 85, "communication": 70, "confidence": 74, "problem_solving": 82,
          "relevant_experience": 88, "leadership": 65, "teamwork": 79, "critical_thinking": 80,
          "behavior": 76, "professionalism": 81},
         RecommendationVerdict.NEED_FURTHER_REVIEW, 6),
    ],
    "aisha.siddiqui@example.com": [
        ("Data Scientist",
         {"technical_skills": 90, "communication": 78, "confidence": 76, "problem_solving": 92,
          "relevant_experience": 84, "leadership": 68, "teamwork": 74, "critical_thinking": 95,
          "behavior": 82, "professionalism": 85},
         RecommendationVerdict.RECOMMENDED, 5),
    ],
    "bilal.hussain@example.com": [
        ("Full Stack Developer",
         {"technical_skills": 62, "communication": 74, "confidence": 68, "problem_solving": 70,
          "relevant_experience": 55, "leadership": 50, "teamwork": 72, "critical_thinking": 66,
          "behavior": 70, "professionalism": 73},
         RecommendationVerdict.NOT_RECOMMENDED, 8),
    ],
    "mahnoor.fatima@example.com": [
        ("Product Manager",
         {"technical_skills": 72, "communication": 95, "confidence": 90, "problem_solving": 86,
          "relevant_experience": 92, "leadership": 94, "teamwork": 93, "critical_thinking": 88,
          "behavior": 96, "professionalism": 95},
         RecommendationVerdict.RECOMMENDED, 2),
    ],
}


def _transcript_for(job: str, name: str) -> tuple[str, list, list]:
    """Return (full_text, segments, speakers) for a realistic interview."""
    lines = [
        "Interviewer: Thank you for joining today. Please tell me about yourself.",
        f"Candidate: My name is {name}. I have been working in this field for several years and I really enjoy solving challenging problems.",
        "Interviewer: Can you walk me through a project you are most proud of?",
        f"Candidate: Absolutely. In my last role I led a project at {name.split()[1] if ' ' in name else 'work'} where we rebuilt our core system. I was responsible for the architecture and delivering on time.",
        "Interviewer: How do you handle tight deadlines and pressure?",
        "Candidate: I prioritize the most critical tasks, communicate early about risks, and stay focused. I have found that clear communication with the team keeps everyone aligned.",
        "Interviewer: What are your strengths and weaknesses?",
        "Candidate: My strength is my attention to detail and problem-solving. A weakness I am working on is delegating more — I tend to take on too much myself, but I am improving.",
        f"Interviewer: Why do you want to work on this {job} role?",
        "Candidate: This role matches my skills and career goals perfectly. I am excited about the opportunity to contribute to meaningful projects and grow with the team.",
        "Interviewer: Thank you. That is all we have for today.",
        "Candidate: Thank you for the opportunity. I look forward to hearing from you.",
    ]
    full = "\n".join(lines)
    segments = []
    t = 0.0
    for line in lines:
        start = t
        # ~4 words/second speaking, plus a small gap between segments.
        words = len(line.split())
        duration = words / 3.2
        end = start + duration
        speaker = "Interviewer" if line.startswith("Interviewer:") else "Candidate"
        text = line.split(": ", 1)[1] if ": " in line else line
        segments.append(
            {"start": round(start, 2), "end": round(end, 2), "text": text,
             "speaker": speaker, "confidence": 0.95}
        )
        t = end + 0.4
    return full, segments, ["Interviewer", "Candidate"]


def _report_for(job: str, name: str, verdict: RecommendationVerdict) -> dict:
    verdict_text = verdict.value
    positive = verdict == RecommendationVerdict.RECOMMENDED
    return {
        "executive_summary": (
            f"{name} demonstrated a {'strong' if positive else 'mixed'} fit for the {job} position. "
            f"The overall assessment is {verdict_text}."
        ),
        "interview_overview": f"Interview conducted for the role of {job}.",
        "candidate_overview": f"{name} presented a clear background and relevant experience.",
        "performance_analysis": (
            "The candidate answered questions with structured reasoning and showed "
            "good command of the core topics."
        ),
        "technical_assessment": (
            "Technical depth was solid — the candidate explained their approach clearly "
            "and handled follow-up questions well."
        ),
        "communication_assessment": (
            "Communication was clear and well-organized, with concise and relevant answers."
        ),
        "confidence_assessment": (
            "The candidate spoke with confidence and maintained a steady, assured tone."
        ),
        "problem_solving_assessment": (
            "Demonstrated a logical, step-by-step approach to problem solving with good "
            "edge-case awareness."
        ),
        "experience_assessment": (
            "Relevant experience aligns well with the requirements of the role."
        ),
        "improvement_suggestions": (
            "- Continue building depth in the core stack.\n"
            "- Practice more leadership and delegation scenarios.\n"
            "- Strengthen portfolio with measurable outcomes."
        ),
    }


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        created = 0
        for email, first, last, phone, gender, job, exp, company in CANDIDATES:
            # Skip if candidate already exists.
            existing = await db.execute(
                select(User).where(User.email == email)
            )
            if existing.scalar_one_or_none():
                print(f"skip {email} (already exists)")
                continue

            user = User(
                email=email,
                role=UserRole.CANDIDATE,
                first_name=first,
                last_name=last,
                phone=phone,
                gender=gender,
                is_active=True,
                password_hash="",  # display-only dummy; no login
            )
            db.add(user)
            await db.flush()

            db.add(CandidateProfile(
                user_id=user.id,
                experience=f"{exp} years in software development",
                skills="Python, SQL, System Design, Communication, Teamwork",
                education="BS Computer Science",
                current_company=company,
                expected_salary="PKR 400,000",
                profile_picture_url="",
                resume_url="",
            ))

            # Create each interview with full evaluation artifacts.
            for job_title, scores, verdict, days_ago in INTERVIEWS[email]:
                created_at = datetime.now(timezone.utc) - timedelta(days=days_ago)
                interview = Interview(
                    candidate_id=user.id,
                    title=f"{job_title} Interview",
                    job_title=job_title,
                    job_description="",
                    evaluation_criteria=[
                        "technical_skills", "communication", "confidence",
                        "problem_solving", "relevant_experience", "leadership",
                        "teamwork", "critical_thinking", "behavior", "professionalism",
                    ],
                    status=InterviewStatus.COMPLETED,
                    started_at=created_at,
                    completed_at=created_at + timedelta(minutes=40),
                    processing_finished_at=created_at + timedelta(minutes=40),
                    duration_seconds=35 * 60,
                    processing_progress=100,
                    current_stage="completed",
                    admin_status="Completed",
                    has_speech=True,
                    created_at=created_at,
                    updated_at=created_at,
                )
                db.add(interview)
                await db.flush()

                overall = round(sum(scores.values()) / len(scores), 1)
                db.add(InterviewScores(
                    interview_id=interview.id, overall_score=overall, **scores
                ))

                full, segments, speakers = _transcript_for(job, f"{first} {last}")
                db.add(Transcript(
                    interview_id=interview.id,
                    full_text=full,
                    segments=segments,
                    speakers=speakers,
                    language="en",
                    confidence=0.95,
                    source="deepgram",
                    raw_response=None,
                ))

                db.add(Recommendation(
                    interview_id=interview.id,
                    verdict=verdict,
                    reason=(
                        f"Strong overall performance aligned with the {job} requirements."
                        if verdict == RecommendationVerdict.RECOMMENDED
                        else "Some areas need improvement before proceeding."
                    ),
                ))

                db.add(SpeechAnalysis(
                    interview_id=interview.id,
                    speech_speed_wpm=145,
                    avg_pause_seconds=0.6,
                    total_pauses=18,
                    speaking_rate=2.4,
                    confidence=82,
                    tone="Professional",
                    emotion="Engaged",
                    clarity=85,
                    fluency=80,
                    energy=78,
                    notes="Good conversational pace with clear articulation.",
                ))
                db.add(SentimentAnalysis(
                    interview_id=interview.id,
                    sentiment="Positive",
                    emotion="Positive",
                    confidence=87,
                    professionalism=88,
                    summary="The conversation was positive and the candidate came across as professional and enthusiastic.",
                ))

                for text in [
                    "Clear and structured communication",
                    "Strong technical knowledge in the core stack",
                    "Good problem-solving approach",
                ]:
                    db.add(Strength(interview_id=interview.id, text=text))
                for text in [
                    "Could delegate more effectively",
                    "Occasionally too detailed in answers",
                ]:
                    db.add(Weakness(interview_id=interview.id, text=text))

                report_data = _report_for(job, f"{first} {last}", verdict)
                db.add(InterviewReport(interview_id=interview.id, **report_data))

            created += 1

        await db.commit()
        print(f"\n✓ Seeded {created} candidates with interviews.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
