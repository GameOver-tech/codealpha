"""Check specific emails in Supabase auth + profiles table state."""
import asyncio
import os
import sys
import traceback

sys.path.insert(0, "backend")


async def main():
    try:
        from dotenv import load_dotenv

        load_dotenv(os.path.join("backend", ".env"))

        from supabase import create_client

        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        sb = create_client(url, key)

        resp = sb.auth.admin.list_users()
        users = resp.users if hasattr(resp, "users") else (resp if isinstance(resp, list) else [])
        emails = {getattr(u, "email", ""): getattr(u, "id", "") for u in users}

        for target in ["admin@gmail.com", "naeem@gmail.com", "ali@gmail.com", "farman@gmail.com"]:
            if target in emails:
                print(f"AUTH EXISTS: {target} id={emails[target]}", flush=True)
            else:
                print(f"AUTH MISSING: {target}", flush=True)

        # Check profiles table
        try:
            profs = sb.table("profiles").select("*").limit(100).execute()
            print(f"\nprofiles rows: {len(profs.data) if profs.data else 0}", flush=True)
            for p in (profs.data or [])[:10]:
                print(f"  profile id={p.get('id')} email={p.get('email')} role={p.get('role')}", flush=True)
        except Exception as exc:
            print("profiles query failed:", exc, flush=True)
    except Exception:
        traceback.print_exc()
        sys.exit(1)


asyncio.run(main())
