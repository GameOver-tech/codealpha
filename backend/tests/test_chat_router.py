"""Tests for the stateless AI chat assistant: role enforcement, tool
execution, and the tool-call loop safety cap."""
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


def _seed_user(session_factory, *, email="c@t.com", role="candidate"):
    from app.models.user import User, UserRole

    async def _seed():
        async with session_factory() as db:
            user = User(email=email, first_name="C", last_name="T", role=UserRole(role))
            db.add(user)
            await db.commit()
            return str(user.id)

    return asyncio.run(_seed())


def _authed_as(client, user_id):
    async def _fake_current_user(credentials=None, db=object()):
        async with database.AsyncSessionLocal() as session:
            from app.repositories.user import UserRepository

            return await UserRepository(session).get(user_id)

    app.dependency_overrides[auth_deps.get_current_user] = _fake_current_user
    return client


def test_chat_requires_auth(client):
    r = client.post("/api/chat", json={"message": "hello"})
    assert r.status_code == 401, r.text


def test_chat_streams_statelessly_with_history(client, monkeypatch):
    """History comes from the client; no conversation tables exist."""
    admin_id = _seed_user(database.AsyncSessionLocal, email="admin@x.com", role="admin")
    _authed_as(client, admin_id)

    captured = {}

    async def _fake_stream(self, messages, tools=None, **kwargs):
        captured["messages"] = messages
        yield {"type": "content", "delta": "Here you go."}
        yield {"type": "done", "content": "Here you go."}

    monkeypatch.setattr("app.ai.chat.agent.GroqChatProvider.stream", _fake_stream)

    r = client.post(
        "/api/chat",
        json={
            "message": "stats?",
            "history": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello!"}],
        },
    )
    assert r.status_code == 200, r.text
    assert "event: message" in r.text
    assert "event: done" in r.text

    roles = [m["role"] for m in captured["messages"]]
    assert roles == ["system", "user", "assistant", "user"]
    contents = [m["content"] for m in captured["messages"] if m["role"] != "system"]
    assert "hi" in contents and "hello!" in contents and "stats?" in contents


def test_tool_execution_runs_against_live_db(client, monkeypatch):
    admin_id = _seed_user(database.AsyncSessionLocal, email="admin@x.com", role="admin")
    _authed_as(client, admin_id)

    async def _fake_stream(self, messages, tools=None, **kwargs):
        # First turn: model calls the dashboard tool; second turn: answers.
        if any(m.get("role") == "tool" for m in messages):
            yield {"type": "content", "delta": "Fetched."}
            yield {"type": "done", "content": "Fetched."}
            return
        yield {
            "type": "tool_call",
            "id": "call_1",
            "name": "get_dashboard_stats",
            "args": "{}",
        }
        yield {"type": "done", "content": ""}

    monkeypatch.setattr("app.ai.chat.agent.GroqChatProvider.stream", _fake_stream)

    r = client.post("/api/chat", json={"message": "stats please"})
    assert r.status_code == 200, r.text
    # Tool executed and a fresh-data result was fed back to the model.
    assert 'event: tool\ndata: {"name": "get_dashboard_stats", "status": "done"}' in r.text


def test_candidate_cannot_call_admin_tools(client):
    """Candidate registry has no admin tools — execution raises cleanly."""
    cand_id = _seed_user(database.AsyncSessionLocal, email="c@t.com", role="candidate")
    _authed_as(client, cand_id)

    from app.ai.chat.tool_router import get_tools_for_role, execute_tool

    assert "get_dashboard_stats" not in get_tools_for_role("candidate")
    assert "list_candidates" not in get_tools_for_role("candidate")

    async def _run():
        async with database.AsyncSessionLocal() as db:
            from app.repositories.user import UserRepository

            user = await UserRepository(db).get(cand_id)
            with pytest.raises(Exception):
                await execute_tool(db, user, "candidate", "get_dashboard_stats", {})

    asyncio.run(_run())


def test_agent_loop_capped_at_max_turns(monkeypatch):
    """A model that only ever returns tool calls must terminate."""
    from app.models.user import User, UserRole
    from app.ai.chat.agent import ChatAgent

    async def _endless(self, messages, tools=None, **kwargs):
        yield {
            "type": "tool_call",
            "id": "call_x",
            "name": "get_dashboard_stats",
            "args": "{}",
        }
        yield {"type": "done", "content": ""}

    monkeypatch.setattr("app.ai.chat.agent.GroqChatProvider.stream", _endless)
    monkeypatch.setattr("app.core.config.settings.CHAT_MAX_TURNS", 3, raising=False)

    async def _run():
        async with database.AsyncSessionLocal() as db:
            from app.repositories.user import UserRepository

            user = await UserRepository(db).get_by_email("admin@x.com")
            if user is None:
                user = User(email="admin@x.com", role=UserRole.ADMIN, first_name="A")
                db.add(user)
                await db.commit()
                await db.refresh(user)
            agent = ChatAgent(db, user)
            events = []
            async for ev in agent.run("hi", []):
                events.append(ev)
            return events

    events = asyncio.run(_run())
    done = [e for e in events if e["type"] == "done"]
    assert len(done) == 1


def test_system_prompt_denies_prompt_reveal():
    from app.models.user import User, UserRole
    from app.ai.chat.system_prompt import build_system_prompt, DENIAL_REPLY

    user = User(email="a@x.com", role=UserRole.ADMIN, first_name="A")
    prompt = build_system_prompt(user)
    assert DENIAL_REPLY in prompt
    assert "show your prompt" in prompt
