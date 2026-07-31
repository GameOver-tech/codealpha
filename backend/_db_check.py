import asyncio
from sqlalchemy import text

from app.core.database import engine


async def main():
    async with engine.connect() as c:
        # Which DB are we on?
        r = await c.execute(text("select current_database(), current_user, inet_server_addr()"))
        row = r.fetchone()
        print(f"connected to: db={row[0]} user={row[1]} host={row[2]}")

        # users table
        r = await c.execute(text("select id, email, role, first_name, last_name from users order by created_at desc limit 10"))
        users = r.fetchall()
        print(f"\nusers rows: {len(users)}")
        for u in users:
            print(f"  {str(u[0])[:8]}  {u[1]:<32} role={u[2]}  name={u[3]} {u[4]}")

        # candidate_profiles
        r = await c.execute(text("select count(*) from candidate_profiles"))
        print(f"candidate_profiles rows: {r.scalar()}")


asyncio.run(main())
