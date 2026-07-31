"""Check current interview states in the DB."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text


async def main():
    from app.core.database import engine

    async with engine.connect() as conn:
        rows = (
            await conn.execute(
                text(
                    "select id, status, error_message, created_at, updated_at "
                    "from interviews order by created_at desc limit 5"
                )
            )
        ).all()
        for r in rows:
            print(r[0], "|", r[1], "|", (r[2] or "")[:80], "|", r[3], "|", r[4])


asyncio.run(main())
