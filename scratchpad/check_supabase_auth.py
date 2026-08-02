"""List Supabase auth users and compare with local auth_uid values.

Identifies whether a candidate's auth_uid in the local users table points
at the admin's Supabase auth account (the smoking gun for 'delete candidate
kills admin login').
"""
import asyncio
import os
import sys
import traceback

sys.path.insert(0, "backend")

ADMIN_AUTH_UID = "4c9d59e2-2fc3-4ccb-a79c-7144a739d439"


async def main():
    try:
        from dotenv import load_dotenv

        load_dotenv(os.path.join("backend", ".env"))

        from supabase import create_client

        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            print("ERROR: missing SUPABASE_URL/SERVICE_ROLE_KEY", flush=True)
            sys.exit(1)

        sb = create_client(url, key)
        resp = sb.auth.admin.list_users()
        users = resp.users if hasattr(resp, "users") else (resp if isinstance(resp, list) else [])
        print(f"total supabase auth users: {len(users)}", flush=True)

        local = {
            "admin@gmail.com": ADMIN_AUTH_UID,
            "farman@gmail.com": "c4fbbf67-66bb-4d35-8ca0-4ce487093c38",
            "test@gmail.com": "171d8457-cf9b-47d9-a4fa-6e73053bcbc8",
        }
        for u in users:
            email = getattr(u, "email", "?")
            uid = getattr(u, "id", "?")
            flag = ""
            if str(uid) == ADMIN_AUTH_UID:
                flag = " <-- ADMIN AUTH"
            elif email in local:
                flag = f" <-- local says auth_uid={local[email]}"
                if str(local[email]) != str(uid):
                    flag += "  MISMATCH!"
            print(f"  {email:45s} id={uid}{flag}", flush=True)
    except Exception:
        traceback.print_exc()
        sys.exit(1)


asyncio.run(main())
