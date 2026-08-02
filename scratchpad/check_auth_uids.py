"""List every user with an auth_uid, sorted by role."""
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
                        "select email, role, auth_uid from users "
                        "where auth_uid is not null order by role"
                    )
                )
            ).all()
            print("=== users with auth_uid ===", flush=True)
            for r in rows:
                print(
                    f"  role={r[1]:10s} email={r[0]:45s} auth_uid={r[2]}",
                    flush=True,
                )
    except Exception:
        traceback.print_exc()
        sys.exit(1)


asyncio.run(main())
