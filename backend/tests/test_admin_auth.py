"""Tests for admin mutation endpoints and auth endpoint failure modes."""
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


async def _seed_candidate(session_factory, *, with_transcript: bool = True):
    from app.models.interview import Interview, InterviewStatus
    from app.models.transcript import Transcript
    from app.models.user import User, UserRole

    async with session_factory() as db:
        user = User(email="c@t.com", first_name="C", last_name="T", role=UserRole.CANDIDATE)
        db.add(user)
        await db.flush()
        interview = Interview(candidate_id=user.id, status=InterviewStatus.UPLOADED)
        db.add(interview)
        await db.flush()
        if with_transcript:
            db.add(Transcript(interview_id=interview.id, full_text="Hi.", segments=[], speakers=[]))
        await db.commit()
        return {"user_id": str(user.id), "interview_id": str(interview.id)}


def _authed_admin(client):
    from app.models.user import User, UserRole

    async def _seed():
        async with database.AsyncSessionLocal() as db:
            admin = User(email="admin@x.com", first_name="A", last_name="D", role=UserRole.ADMIN)
            db.add(admin)
            await db.commit()
            return str(admin.id)

    admin_id = asyncio.run(_seed())

    async def _fake_admin(credentials=None, db=object()):
        async with database.AsyncSessionLocal() as session:
            from app.repositories.user import UserRepository

            return await UserRepository(session).get(admin_id)

    app.dependency_overrides[auth_deps.get_current_user] = _fake_admin
    return client


def test_admin_process_endpoint(client):
    ids = asyncio.run(_seed_candidate(database.AsyncSessionLocal))
    _authed_admin(client)
    r = client.post("/api/admin/process", json={"interview_id": ids["interview_id"]})
    assert r.status_code == 202, r.text
    assert r.json()["status"] == "processing"


def test_admin_process_rejects_completed(client):
    ids = asyncio.run(_seed_candidate(database.AsyncSessionLocal))
    _authed_admin(client)
    # Mark completed
    from app.models.interview import InterviewStatus
    from app.repositories.interview import InterviewRepository

    async def _mark():
        async with database.AsyncSessionLocal() as db:
            await InterviewRepository(db).set_status(ids["interview_id"], InterviewStatus.COMPLETED)
            await db.commit()

    asyncio.run(_mark())
    r = client.post("/api/admin/process", json={"interview_id": ids["interview_id"]})
    assert r.status_code == 400, r.text  # already processing


def test_admin_regenerate_endpoint(client):
    ids = asyncio.run(_seed_candidate(database.AsyncSessionLocal, with_transcript=True))
    _authed_admin(client)
    r = client.post("/api/admin/regenerate", json={"interview_id": ids["interview_id"]})
    assert r.status_code == 202, r.text


def test_admin_regenerate_without_transcript_404(client):
    ids = asyncio.run(_seed_candidate(database.AsyncSessionLocal, with_transcript=False))
    _authed_admin(client)
    r = client.post("/api/admin/regenerate", json={"interview_id": ids["interview_id"]})
    assert r.status_code == 404, r.text


def test_admin_override_recommendation(client):
    ids = asyncio.run(_seed_candidate(database.AsyncSessionLocal))
    _authed_admin(client)
    r = client.post(
        f"/api/admin/status/recommendation/not-recommendation?interview_id={ids['interview_id']}&verdict=Not%20Recommended",
    )
    assert r.status_code == 200, r.text
    assert r.json()["verdict"] == "Not Recommended"


def test_admin_override_invalid_verdict(client):
    ids = asyncio.run(_seed_candidate(database.AsyncSessionLocal))
    _authed_admin(client)
    r = client.post(
        f"/api/admin/status/recommendation/not-recommendation?interview_id={ids['interview_id']}&verdict=Maybe",
    )
    assert r.status_code == 400, r.text


def test_admin_delete_interview(client):
    ids = asyncio.run(_seed_candidate(database.AsyncSessionLocal))
    _authed_admin(client)
    r = client.delete(f"/api/admin/interview/{ids['interview_id']}")
    assert r.status_code == 200, r.text


def test_admin_delete_missing_404(client):
    _authed_admin(client)
    r = client.delete(f"/api/admin/interview/{uuid.uuid4()}")
    assert r.status_code == 404, r.text


def test_auth_endpoints_do_not_500(client):
    """Supabase-dependent endpoints must never return a 500.

    With real Supabase credentials configured they succeed (201/200); without
    them they fail with a clean 4xx/502. Either way, never an unhandled 500.
    """
    # Register — succeeds with live Supabase creds, else clean 4xx/502.
    r = client.post(
        "/api/auth/register",
        json={
            "first_name": "A",
            "last_name": "B",
            "email": f"test-{uuid.uuid4().hex[:8]}@t.com",
            "password": "password123",
            "phone": "",
            "gender": "",
        },
    )
    assert r.status_code in (201, 400, 401, 409, 422, 502), r.text

    # Login with wrong password -> 401
    r = client.post("/api/auth/login", json={"email": "x@t.com", "password": "wrongpass"})
    assert r.status_code in (400, 401, 502), r.text

    # /me without token -> 401 (auth dependency, no Supabase needed)
    r = client.get("/api/auth/me")
    assert r.status_code == 401, r.text

    # /logout without token -> 401
    r = client.post("/api/auth/logout")
    assert r.status_code == 401, r.text
