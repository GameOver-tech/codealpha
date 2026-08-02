"""Check admin user rows and auth_uid."""
import asyncio
import sys
import traceback

sys.path.insert(0, "backend")


async def main():
    try:
        from sqlalchemy import text
        from app.core.database import engine

        async with engine.connect() as conn:
            rows = (
                await conn.execute(
                    text(
                        "select id, email, role, is_active, auth_uid "
                        "from users where role='admin'"
                    )
                )
            ).all()
            print("ADMINS:", len(rows), flush=True)
            for r in rows:
                print(
                    "admin:", r[1], "| id:", str(r[0]), "| active:", r[3],
                    "| auth_uid:", str(r[4]) if r[4] else None,
                    flush=True,
                )
            total = (await conn.execute(text("select count(*) from users"))).scalar()
            print("total users:", total, flush=True)
    except Exception:
        traceback.print_exc()
        sys.exit(1)


asyncio.run(main())
