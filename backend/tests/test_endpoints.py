"""End-to-end handler tests with in-memory SQLite + seeded data + mocked auth.

These exercise the real request -> handler -> repository -> response_model
path so response-serialization 500s (UUID -> str, etc.) are caught.
"""
import asyncio
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.core import database
from app.dependencies import auth as auth_deps
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
def client(monkeypatch):
    engine = create_async_engine(TEST_DB_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _create_tables():
        from app.models.base import Base
        import app.models  # noqa: F401

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_create_tables())

    async def _override_db():
        async with session_factory() as session:
            yield session

    monkeypatch.setattr(database, "AsyncSessionLocal", session_factory)
    app.dependency_overrides[database.get_db] = _override_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


async def _seed(session_factory, **kwargs):
    from app.models.interview import Interview, InterviewStatus
    from app.models.interview_report import InterviewReport
    from app.models.interview_scores import InterviewScores
    from app.models.recommendation import Recommendation, RecommendationVerdict
    from app.models.strength import Strength, Weakness
    from app.models.transcript import Transcript
    from app.models.user import User, UserRole

    async with session_factory() as db:
        user = User(
            email=kwargs.get("email", "candidate@test.com"),
            first_name="Alice",
            last_name="Johnson",
            role=UserRole.CANDIDATE,
            phone="555",
            gender="female",
        )
        db.add(user)
        await db.flush()

        interview = Interview(
            candidate_id=user.id,
            title="Interview",
            status=InterviewStatus.COMPLETED,
            job_title="Backend Engineer",
            duration_seconds=600,
        )
        db.add(interview)
        await db.flush()

        db.add(Transcript(interview_id=interview.id, full_text="Hello world.", segments=[], speakers=[]))
        db.add(InterviewScores(interview_id=interview.id, overall_score=81.0))
        db.add(Strength(interview_id=interview.id, text="Strong communication"))
        db.add(Weakness(interview_id=interview.id, text="Needs more depth"))
        db.add(
            Recommendation(
                interview_id=interview.id,
                verdict=RecommendationVerdict.RECOMMENDED,
                reason="Meets criteria",
            )
        )
        db.add(
            InterviewReport(
                interview_id=interview.id,
                executive_summary="Good",
                interview_overview="Overview",
                candidate_overview="Candidate",
                performance_analysis="Perf",
                technical_assessment="Tech",
                communication_assessment="Comm",
                confidence_assessment="Conf",
                problem_solving_assessment="PS",
                experience_assessment="Exp",
                improvement_suggestions="Improve",
            )
        )
        await db.commit()
        return {"user_id": str(user.id), "interview_id": str(interview.id)}


def _authed_client(client, user_id: str):
    """Mock get_current_user so we don't need real JWTs."""
    from app.models.user import User

    async def _fake_current_user(
        credentials=None, db=object(),
    ) -> User:
        async with database.AsyncSessionLocal() as session:
            from app.repositories.user import UserRepository

            return await UserRepository(session).get(user_id)

    app.dependency_overrides[auth_deps.get_current_user] = _fake_current_user
    return client


def _authed_admin_client(client):
    """Mock get_current_user with an admin user (for admin-only endpoints)."""
    from app.models.user import User, UserRole

    async def _seed_admin():
        async with database.AsyncSessionLocal() as db:
            admin = User(
                email="admin@test.com",
                first_name="A",
                last_name="D",
                role=UserRole.ADMIN,
            )
            db.add(admin)
            await db.commit()
            return str(admin.id)

    admin_id = asyncio.run(_seed_admin())

    async def _fake_admin(credentials=None, db=object()):
        async with database.AsyncSessionLocal() as session:
            from app.repositories.user import UserRepository

            return await UserRepository(session).get(admin_id)

    app.dependency_overrides[auth_deps.get_current_user] = _fake_admin
    return client


def test_candidate_status_endpoint(client, monkeypatch):
    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    _authed_client(client, ids["user_id"])
    r = client.get("/api/interview/status")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "completed"
    assert isinstance(data["id"], str)
    assert data["recommendation"] == "Recommended"


def test_candidate_result_endpoint(client, monkeypatch):
    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    _authed_client(client, ids["user_id"])
    r = client.get("/api/interview/result")
    assert r.status_code == 200, r.text
    data = r.json()
    # Candidates only see status + recommendation verdict — never scores,
    # transcript, strengths/weaknesses or the report.
    assert data["interview_id"] == ids["interview_id"]
    assert data["recommendation"] == "Recommended"
    assert data["duration_seconds"] == 600
    assert "scores" not in data
    assert "transcript" not in data
    assert "strengths" not in data
    assert "report" not in data


def test_candidate_result_duration_derived_from_transcript_end(client, monkeypatch):
    """The result duration must come from the transcript's last segment end."""
    from app.models.transcript import Transcript

    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    # Give the interview a real transcript whose final segment ends at 1912.6s.
    async def _update():
        async with database.AsyncSessionLocal() as db:
            import uuid as _uuid

            from sqlalchemy import select

            tx = (
                await db.execute(
                    select(Transcript).where(
                        Transcript.interview_id == _uuid.UUID(ids["interview_id"])
                    )
                )
            ).scalar_one()
            tx.segments = [
                {"start": 0.0, "end": 8.4, "text": "Hello.", "speaker": "A"},
                {"start": 1845.2, "end": 1912.6, "text": "Closing.", "speaker": "B"},
            ]
            await db.commit()

    asyncio.run(_update())
    _authed_client(client, ids["user_id"])
    r = client.get("/api/interview/result")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["duration_seconds"] == 1913  # round(1912.6) — overrides stored 600


def test_candidate_cannot_download_pdf(client, monkeypatch):
    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    _authed_client(client, ids["user_id"])
    r = client.get("/api/interview/result/pdf")
    assert r.status_code == 403, r.text


def test_admin_transcript_endpoint(client, monkeypatch):
    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    _authed_admin_client(client)
    r = client.get(f"/api/admin/transcript?interview_id={ids['interview_id']}")
    assert r.status_code == 200, r.text
    assert r.json()["full_text"] == "Hello world."


def test_admin_scores_endpoint(client, monkeypatch):
    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    _authed_admin_client(client)
    r = client.get(f"/api/admin/scores?interview_id={ids['interview_id']}")
    assert r.status_code == 200, r.text
    assert r.json()["overall_score"] == 81.0


def test_admin_recommendation_endpoint(client, monkeypatch):
    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    _authed_admin_client(client)
    r = client.get(f"/api/admin/recommendation?interview_id={ids['interview_id']}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["verdict"] == "Recommended"
    assert "Congratulations" in data["message"]


def test_admin_report_endpoint(client, monkeypatch):
    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    _authed_admin_client(client)
    r = client.get(f"/api/admin/report?interview_id={ids['interview_id']}")
    assert r.status_code == 200, r.text
    assert r.json()["executive_summary"] == "Good"


def test_admin_analysis_endpoint(client, monkeypatch):
    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    _authed_admin_client(client)
    r = client.get(f"/api/admin/analysis?interview_id={ids['interview_id']}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["transcript"]["full_text"] == "Hello world."
    assert data["scores"]["overall_score"] == 81.0
    assert data["recommendation"]["verdict"] == "Recommended"
    assert data["strengths"] == ["Strong communication"]


def test_admin_list_interviews(client, monkeypatch):
    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    _authed_admin_client(client)
    r = client.get("/api/admin/interviews")
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data) == 1
    assert data[0]["candidate_email"] == "candidate@test.com"
    assert data[0]["overall_score"] == 81.0


def test_profile_endpoints_require_auth(client):
    r = client.get("/api/profile")
    assert r.status_code == 401, r.text


def test_profile_get_and_update(client, monkeypatch):
    ids = asyncio.run(_seed(database.AsyncSessionLocal))
    _authed_client(client, ids["user_id"])

    r = client.get("/api/profile")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user_id"] == ids["user_id"]

    r = client.put(
        "/api/profile",
        json={"experience": "5 years", "skills": "Python, FastAPI", "education": "BSc"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["experience"] == "5 years"


def test_jobs_create_and_list(client, monkeypatch):
    from app.models.user import User, UserRole

    async def _seed_admin():
        async with database.AsyncSessionLocal() as db:
            admin = User(email="admin@test.com", first_name="A", last_name="D", role=UserRole.ADMIN)
            db.add(admin)
            await db.commit()
            return str(admin.id)

    admin_id = asyncio.run(_seed_admin())

    # Admin list (public)
    r = client.get("/api/jobs")
    assert r.status_code == 200, r.text

    # Create as admin
    async def _fake_admin(credentials=None, db=object()):
        async with database.AsyncSessionLocal() as session:
            from app.repositories.user import UserRepository

            return await UserRepository(session).get(admin_id)

    app.dependency_overrides[auth_deps.get_current_user] = _fake_admin
    r = client.post("/api/jobs", json={"title": "Backend", "description": "Build APIs"})
    assert r.status_code == 201, r.text
    assert r.json()["title"] == "Backend"

    r = client.get("/api/jobs")
    assert r.status_code == 200, r.text
    assert len(r.json()) == 1


def test_admin_upload_requires_candidate_email(client, monkeypatch):
    """Upload without a candidate_email must be rejected (no anonymous interviews)."""
    from app.models.user import User, UserRole

    async def _seed_admin():
        async with database.AsyncSessionLocal() as db:
            admin = User(email="admin@test.com", first_name="A", last_name="D", role=UserRole.ADMIN)
            db.add(admin)
            await db.commit()
            return str(admin.id)

    admin_id = asyncio.run(_seed_admin())

    async def _fake_admin(credentials=None, db=object()):
        async with database.AsyncSessionLocal() as session:
            from app.repositories.user import UserRepository

            return await UserRepository(session).get(admin_id)

    app.dependency_overrides[auth_deps.get_current_user] = _fake_admin

    # No candidate_email field -> 422 validation error
    r = client.post(
        "/api/admin/upload",
        files={"file": ("rec.mp4", b"fake-video-bytes", "video/mp4")},
        data={"job_title": "Engineer"},
    )
    assert r.status_code == 422, r.text


def test_admin_upload_unknown_email_404(client, monkeypatch):
    """Uploading for a non-existent candidate email must be rejected with 404."""
    from app.models.user import User, UserRole

    async def _seed_admin():
        async with database.AsyncSessionLocal() as db:
            admin = User(email="admin@test.com", first_name="A", last_name="D", role=UserRole.ADMIN)
            db.add(admin)
            await db.commit()
            return str(admin.id)

    admin_id = asyncio.run(_seed_admin())

    async def _fake_admin(credentials=None, db=object()):
        async with database.AsyncSessionLocal() as session:
            from app.repositories.user import UserRepository

            return await UserRepository(session).get(admin_id)

    app.dependency_overrides[auth_deps.get_current_user] = _fake_admin

    r = client.post(
        "/api/admin/upload",
        files={"file": ("rec.mp4", b"fake-video-bytes", "video/mp4")},
        data={"candidate_email": "does-not-exist@test.com", "job_title": "Engineer"},
    )
    assert r.status_code == 404, r.text
    assert "No candidate found" in r.json()["detail"]


def test_admin_upload_links_to_candidate(client, monkeypatch):
    """Upload for an existing candidate links the interview to their user id."""
    from app.models.interview import Interview, InterviewStatus
    from app.models.user import User, UserRole
    from app.repositories.interview import InterviewRepository

    async def _seed():
        async with database.AsyncSessionLocal() as db:
            admin = User(email="admin@test.com", first_name="A", last_name="D", role=UserRole.ADMIN)
            db.add(admin)
            await db.flush()
            candidate = User(
                email="real-candidate@test.com",
                first_name="Real",
                last_name="Candidate",
                role=UserRole.CANDIDATE,
            )
            db.add(candidate)
            await db.commit()
            return {"admin_id": str(admin.id), "candidate_id": str(candidate.id)}

    ids = asyncio.run(_seed())

    async def _fake_admin(credentials=None, db=object()):
        async with database.AsyncSessionLocal() as session:
            from app.repositories.user import UserRepository

            return await UserRepository(session).get(ids["admin_id"])

    app.dependency_overrides[auth_deps.get_current_user] = _fake_admin

    r = client.post(
        "/api/admin/upload",
        files={"file": ("rec.mp4", b"fake-video-bytes", "video/mp4")},
        data={"candidate_email": "real-candidate@test.com", "job_title": "Engineer"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["candidate_id"] == ids["candidate_id"]
    assert data["candidate_email"] == "real-candidate@test.com"

    # The interview must be owned by the candidate, not the admin.
    async def _verify():
        async with database.AsyncSessionLocal() as db:
            interviews = await InterviewRepository(db).list_by_candidate(ids["candidate_id"])
            return len(interviews) == 1

    assert asyncio.run(_verify())
