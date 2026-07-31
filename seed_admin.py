"""
Idempotent admin seed script.

Creates the admin user (admin@gmail.com / 12345678) in Supabase Auth
and inserts a matching row into the profiles table with role = 'admin'.

Usage:
    pip install -r backend/requirements.txt
    python seed_admin.py

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set
in a .env file in the project root or as environment variables.
"""

import os
import sys
from pathlib import Path

# Windows consoles default to cp1252 — force UTF-8 so the ✓ prints cleanly
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from dotenv import load_dotenv

# Load .env from project root (two levels up from this script)
env_path = Path(__file__).resolve().parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    # Fall back to root-level .env
    root_env = Path(__file__).resolve().parent / ".env"
    if root_env.exists():
        load_dotenv(root_env)

from supabase import create_client

ADMIN_EMAIL = "admin@gmail.com"
ADMIN_PASSWORD = "12345678"
ADMIN_ROLE = "admin"


def _list_users(sb):
    """Return a list of auth users, tolerant of SDK response shape differences."""
    resp = sb.auth.admin.list_users()
    # Newer SDKs return an object with .users; older return a list directly
    if hasattr(resp, "users"):
        return resp.users
    if isinstance(resp, list):
        return resp
    return []


def main():
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)

    sb = create_client(supabase_url, service_role_key)

    # --- Step 1: Check if admin already exists in auth.users ---
    print(f"Checking if {ADMIN_EMAIL} already exists in auth.users...")
    user = None
    try:
        users = _list_users(sb)
        user = next((u for u in users if u.email == ADMIN_EMAIL), None)
    except Exception as e:
        print(f"Could not list users via admin API: {e}")
        print("Proceeding to attempt creation (it will fail gracefully if user exists).")

    if user:
        print(f"Admin user already exists with id={user.id}, skipping auth creation.")
    else:
        # --- Step 2: Create the admin user in auth.users ---
        print(f"Creating admin user {ADMIN_EMAIL} in auth.users...")
        try:
            resp = sb.auth.admin.create_user(
                {
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD,
                    "email_confirm": True,
                }
            )
            user = resp.user
            print(f"Created admin user with id={user.id}")
        except Exception as e:
            error_str = str(e).lower()
            if "already exists" in error_str or "duplicate" in error_str:
                print("Admin user already exists (race condition), continuing...")
                try:
                    users = _list_users(sb)
                    user = next((u for u in users if u.email == ADMIN_EMAIL), None)
                except Exception:
                    user = None
                if not user:
                    print("ERROR: Could not retrieve existing admin user.")
                    sys.exit(1)
            else:
                print(f"ERROR creating admin user: {e}")
                sys.exit(1)

    admin_id = user.id

    # --- Step 3: Ensure a profile row exists ---
    print(f"Ensuring profile row exists for {admin_id}...")
    try:
        existing_profile = (
            sb.table("profiles").select("*").eq("id", admin_id).maybe_single().execute()
        )
        if existing_profile.data:
            print("Profile row already exists, updating role to admin...")
            sb.table("profiles").update({"role": ADMIN_ROLE}).eq(
                "id", admin_id
            ).execute()
        else:
            print("Creating profile row with role=admin...")
            sb.table("profiles").insert(
                {
                    "id": admin_id,
                    "email": ADMIN_EMAIL,
                    "role": ADMIN_ROLE,
                    "full_name": "Admin",
                }
            ).execute()
    except Exception as e:
        print(f"ERROR managing profile row: {e}")
        print(
            "Hint: Make sure the schema.sql has been run in the Supabase SQL Editor "
            "(it grants privileges to service_role for the profiles table)."
        )
        sys.exit(1)

    print("\n✓ Admin seed completed successfully.")
    print(f"  Email:    {ADMIN_EMAIL}")
    print(f"  Password: {ADMIN_PASSWORD}")


if __name__ == "__main__":
    main()
