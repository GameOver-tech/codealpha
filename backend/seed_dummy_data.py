"""
HireLens AI — Seed Dummy Candidate Data
Creates 8 realistic candidates with completed interviews and AI evaluations.

Usage:
    cd backend
    python seed_dummy_data.py

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
"""

import os
import uuid
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

CANDIDATES = [
    {
        "full_name": "Sarah Johnson",
        "email": "sarah.johnson@example.com",
        "photo_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        "job_idx": 0,
        "scores": (92, 88, 85, 95, 90),
        "recommendation": "Recommended",
        "strengths": [
            "Excellent system design and architectural thinking",
            "Strong grasp of distributed systems concepts",
            "Clear and articulate communication of technical ideas",
            "Demonstrated leadership experience in previous roles",
        ],
        "weaknesses": [
            "Could improve depth in database optimization techniques",
            "Occasionally overcomplicates simple solutions",
        ],
        "summary": "Sarah demonstrated exceptional technical proficiency across all evaluation criteria. Her system design answers were well-structured and showed deep understanding of scalability challenges. She communicated clearly and confidently throughout the interview. Recommended for senior role.",
    },
    {
        "full_name": "Michael Chen",
        "email": "michael.chen@example.com",
        "photo_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
        "job_idx": 0,
        "scores": (78, 72, 65, 80, 75),
        "recommendation": "Need Further Review",
        "strengths": [
            "Good problem-solving approach with logical reasoning",
            "Solid understanding of core programming concepts",
            "Honest about areas of improvement",
        ],
        "weaknesses": [
            "Confidence level affected performance in technical questions",
            "Communication could be more structured and concise",
            "Limited experience with cloud-native architectures",
        ],
        "summary": "Michael showed good technical fundamentals and problem-solving ability, but his lack of confidence impacted his overall performance. His answers were technically correct but lacked the depth expected for a senior role. With some mentoring, he has strong potential.",
    },
    {
        "full_name": "Emily Rodriguez",
        "email": "emily.r@example.com",
        "photo_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
        "job_idx": 1,
        "scores": (95, 90, 88, 92, 85),
        "recommendation": "Recommended",
        "strengths": [
            "Exceptional React and TypeScript expertise",
            "Beautiful design sensibility with strong UX focus",
            "Excellent communication and team collaboration",
            "Proven track record of shipping high-quality products",
        ],
        "weaknesses": [
            "Could deepen backend knowledge for full-stack versatility",
            "Occasionally spends too much time on pixel-perfection",
        ],
        "summary": "Emily is an outstanding frontend developer with a rare combination of technical skill and design intuition. Her portfolio demonstrated real-world impact, and her live coding session was flawless. Strongly recommended for the frontend role.",
    },
    {
        "full_name": "David Kim",
        "email": "david.kim@example.com",
        "photo_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed=David",
        "job_idx": 1,
        "scores": (45, 60, 55, 50, 48),
        "recommendation": "Not Recommended",
        "strengths": [
            "Enthusiastic and eager to learn",
            "Basic understanding of React components",
        ],
        "weaknesses": [
            "Insufficient depth in JavaScript fundamentals",
            "Unable to complete the live coding exercise",
            "Limited experience with modern frontend tooling",
            "Struggled with state management concepts",
        ],
        "summary": "David demonstrated enthusiasm but lacked the technical depth required for this role. His JavaScript fundamentals need significant improvement, and he was unable to complete the coding assessment. We recommend he gain more experience before reapplying.",
    },
    {
        "full_name": "Priya Patel",
        "email": "priya.patel@example.com",
        "photo_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed=Priya",
        "job_idx": 2,
        "scores": (88, 82, 80, 90, 93),
        "recommendation": "Recommended",
        "strengths": [
            "Strong statistical analysis and ML modeling skills",
            "Excellent data visualization and storytelling",
            "Deep understanding of experimental design",
            "Published research in relevant field",
        ],
        "weaknesses": [
            "Could improve Python code optimization",
            "Presentation style slightly too technical for non-experts",
        ],
        "summary": "Priya is a strong data scientist with both the theoretical foundation and practical application skills. Her take-home analysis was thorough and insightful, and her presentation was well-received. Highly recommended for the data scientist role.",
    },
    {
        "full_name": "James Wilson",
        "email": "james.wilson@example.com",
        "photo_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed=James",
        "job_idx": 2,
        "scores": (70, 75, 72, 68, 80),
        "recommendation": "Need Further Review",
        "strengths": [
            "Solid domain knowledge in analytics",
            "Good communication skills",
            "Relevant industry experience",
        ],
        "weaknesses": [
            "ML framework knowledge needs updating",
            "Took longer than expected on the technical assessment",
            "Limited experience with production ML pipelines",
        ],
        "summary": "James has relevant domain experience and communicates well, but his technical skills in modern ML frameworks need updating. He would benefit from a structured onboarding period. Consider for a mid-level role.",
    },
    {
        "full_name": "Aisha Mohammed",
        "email": "aisha.m@example.com",
        "photo_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed=Aisha",
        "job_idx": 0,
        "scores": (85, 90, 92, 82, 78),
        "recommendation": "Recommended",
        "strengths": [
            "Exceptional communication and leadership skills",
            "Strong full-stack development experience",
            "Excellent cultural fit and team orientation",
            "Demonstrated ability to mentor junior engineers",
        ],
        "weaknesses": [
            "Less experience with the specific cloud provider we use",
            "Could improve knowledge of security best practices",
        ],
        "summary": "Aisha is a well-rounded engineer with strong technical skills and outstanding soft skills. Her leadership experience and team-oriented approach make her an excellent addition. The learning curve on our specific tech stack is minimal.",
    },
    {
        "full_name": "Tomás García",
        "email": "tomas.garcia@example.com",
        "photo_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed=Tomas",
        "job_idx": 0,
        "scores": (58, 65, 60, 55, 62),
        "recommendation": "Not Recommended",
        "strengths": [
            "Good foundational knowledge",
            "Pleasant and professional demeanor",
        ],
        "weaknesses": [
            "Answers lacked depth and specificity",
            "Unable to discuss system design at senior level",
            "Limited experience with large-scale systems",
            "Technical vocabulary needs improvement",
        ],
        "summary": "Tomás has foundational knowledge but does not yet meet the bar for a senior engineering role. His answers lacked the depth and specificity expected. We encourage him to gain more experience with large-scale systems and reapply in the future.",
    },
]

JOB_TITLES = [
    "Senior Software Engineer",
    "Frontend Developer",
    "Data Scientist",
]


def seed_dummy_data():
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        return

    client: Client = create_client(supabase_url, service_role_key)

    # Get existing jobs
    jobs = client.table("jobs").select("id, title").execute()
    if not jobs.data:
        print("ERROR: No jobs found. Run migration.sql first.")
        return

    job_map = {j["title"]: j["id"] for j in jobs.data}

    # Check if dummy data already exists
    existing = client.table("candidates").select("id").limit(1).execute()
    if existing.data and len(existing.data) > 5:
        print(f"Dummy data already seeded ({len(existing.data)} candidates found). Skipping.")
        return

    created_count = 0
    for c in CANDIDATES:
        candidate_id = str(uuid.uuid4())

        # Create auth user (needed for profiles FK)
        try:
            resp = client.auth.admin.create_user({
                "email": c["email"],
                "password": "password123",
                "email_confirm": True,
                "user_metadata": {"full_name": c["full_name"], "avatar_url": c["photo_url"]},
            })
            user_id = resp.user.id
        except Exception as e:
            if "already exists" in str(e).lower():
                # Look up existing user
                users = client.auth.admin.list_users()
                existing_user = next((u for u in users if u.email == c["email"]), None)
                if existing_user:
                    user_id = existing_user.id
                else:
                    print(f"  SKIP {c['full_name']}: could not create or find auth user")
                    continue
            else:
                print(f"  SKIP {c['full_name']}: {e}")
                continue

        # Insert profile
        client.table("profiles").upsert({"id": user_id, "role": "candidate"}).execute()

        # Insert candidate
        candidate_data = {
            "id": user_id,
            "full_name": c["full_name"],
            "email": c["email"],
            "photo_url": c["photo_url"],
        }
        client.table("candidates").upsert(candidate_data).execute()

        # Get job ID
        job_title = JOB_TITLES[c["job_idx"]]
        job_id = job_map.get(job_title)
        if not job_id:
            print(f"  SKIP {c['full_name']}: job '{job_title}' not found")
            continue

        # Create interview
        interview_id = str(uuid.uuid4())
        days_ago = timedelta(days=created_count * 3 + 1)
        interview_data = {
            "id": interview_id,
            "candidate_id": user_id,
            "job_id": job_id,
            "status": "completed",
            "created_at": (datetime.utcnow() - days_ago).isoformat(),
            "updated_at": (datetime.utcnow() - days_ago).isoformat(),
        }
        client.table("interviews").upsert(interview_data).execute()

        # Create transcript
        transcript_data = {
            "id": str(uuid.uuid4()),
            "interview_id": interview_id,
            "raw_transcript": f"Raw transcript for {c['full_name']}'s interview for {job_title} position.",
            "refined_transcript": f"This is the refined transcript of the interview with {c['full_name']} for the {job_title} position at TechCorp Inc. The candidate discussed their background, technical experience, and answered questions about system design, problem-solving, and team collaboration.",
        }
        client.table("transcripts").upsert(transcript_data).execute()

        # Create evaluation
        tech, comm, conf, prob, exp = c["scores"]
        overall = round((tech + comm + conf + prob + exp) / 5)
        evaluation_data = {
            "id": str(uuid.uuid4()),
            "interview_id": interview_id,
            "technical_score": float(tech),
            "communication_score": float(comm),
            "confidence_score": float(conf),
            "problem_solving_score": float(prob),
            "experience_score": float(exp),
            "overall_score": float(overall),
            "recommendation": c["recommendation"],
            "strengths": c["strengths"],
            "weaknesses": c["weaknesses"],
            "ai_summary": c["summary"],
            "evidence": {
                "Technical Knowledge": [
                    {"quote": f"{c['full_name']} demonstrated strong understanding of core concepts relevant to the {job_title} position.", "timestamp": "12:30"},
                    {"quote": "Responses to technical questions were well-structured and showed depth of knowledge.", "timestamp": "18:45"},
                ],
                "Problem Solving": [
                    {"quote": "Approached the coding challenge methodically, breaking down the problem before writing solutions.", "timestamp": "25:10"},
                ],
                "Communication Skills": [
                    {"quote": "Articulated complex ideas clearly and adjusted explanations based on the interviewer's questions.", "timestamp": "32:00"},
                ],
            },
        }
        client.table("evaluations").upsert(evaluation_data).execute()

        print(f"  ✓ {c['full_name']} ({c['recommendation']}, {overall}/100)")
        created_count += 1

    print(f"\nDone! Created {created_count} candidates with interview data.")


if __name__ == "__main__":
    seed_dummy_data()
