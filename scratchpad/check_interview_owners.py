"""Check candidate rows that own interviews (naeem, ali) vs admin auth_uid."""
import asyncio
import sys
import traceback

sys.path.insert(0, "backend")

ADMIN_AUTH_UID = "4c9d59e2-2fc3-4ccb-a79c-7144a739d439"


async def main():
    try:
        from sqlalchemy import text
        from app.core.database import engine

        async with engine.connect() as conn:
            rows = (
                await conn.execute(
                    text(
                        "select id, email, role, is_active, auth_uid from users "
                        "where email in ('naeem@gmail.com','ali@gmail.com','admin@gmail.com')"
                    )
                )
            ).all()
            for r in rows:
                match = " <-- MATCHES ADMIN" if str(r[4]) == ADMIN_AUTH_UID else ""
                print(
                    f"email={r[1]} | id={r[0]} | role={r[2]} | active={r[3]} | auth_uid={r[4]}{match}",
                    flush=True,
                )
    except Exception:
        traceback.print_exc()
        sys.exit(1)


asyncio.run(main())
