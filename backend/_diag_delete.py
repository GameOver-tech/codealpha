"""Check current DB state: users + interviews to correlate with the screenshot."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


async def main():
    from sqlalchemy import text
    from app.core.database import engine

    async with engine.connect() as conn:
        rows = (
            await conn.execute(
                text(
                    "select u.id, u.email, u.role, u.is_active, u.auth_uid, "
                    "(select count(*) from interviews i where i.candidate_id = u.id) as n_int "
                    "from users u order by u.created_at desc limit 15"
                )
            )
        ).all()
        print("=== users (latest 15) ===")
        for r in rows:
            print(
                "user:", str(r[0])[:8], "|", r[1], "| role:", r[2], "| active:", r[3],
                "| auth_uid:", str(r[4])[:8] if r[4] else None, "| interviews:", r[5],
            )

        ints = (
            await conn.execute(
                text(
                    "select i.id, i.job_title, i.status, u.email, i.created_at "
                    "from interviews i join users u on u.id = i.candidate_id "
                    "order by i.created_at desc limit 10"
                )
            )
        ).all()
        print("\n=== interviews (latest 10) ===")
        for r in ints:
            print("interview:", str(r[0])[:8], "|", r[1], "|", r[2], "|", r[3], "|", r[4])


asyncio.run(main())
