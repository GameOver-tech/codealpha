"""
HireLens AI — Seed Admin User & Run Migrations

Run this script to:
1. Create all database tables (if they don't exist)
2. Set up Row Level Security policies
3. Seed job listings
4. Create the admin user account

Usage:
    cd backend
    python seed_admin.py

Make sure .env is configured with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()


def run_migrations(client: Client):
    """Run the SQL migration file."""
    migration_path = os.path.join(
        os.path.dirname(__file__), "app", "db", "migrations", "000_run_all.sql"
    )
    if not os.path.exists(migration_path):
        print(f"WARNING: Migration file not found at {migration_path}")
        print("Please run the SQL in the Supabase dashboard SQL editor manually.")
        return

    with open(migration_path, "r", encoding="utf-8") as f:
        sql = f.read()

    # Split by statement and execute each
    # The Supabase Python client doesn't support raw SQL directly,
    # so we use the REST API with the service role key
    import httpx

    project_ref = client.supabase_url.split("//")[1].split(".")[0]
    rpc_url = f"https://{project_ref}.supabase.co/rest/v1/rpc/"
    headers = {
        "apikey": client.supabase_key,
        "Authorization": f"Bearer {client.supabase_key}",
        "Content-Type": "application/json",
    }

    # Try using the Supabase pg_query function
    response = httpx.post(
        f"https://{project_ref}.supabase.co/rest/v1/rpc/pg_exec",
        headers=headers,
        json={"query": sql},
    )

    if response.status_code == 200:
        print("Migrations applied successfully!")
    elif response.status_code == 404:
        # rpc not available — just print instructions
        print(
            "Migrations need to be run manually in the Supabase SQL editor."
        )
        print(f"SQL file location: {migration_path}")
        print("Open your Supabase dashboard → SQL Editor → New Query")
        print("Copy the contents of the file above and paste it in.")
    else:
        print(f"Migration note: {response.status_code} {response.text[:200]}")


def seed_admin():
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        return

    client: Client = create_client(supabase_url, service_role_key)

    # Run migrations first
    run_migrations(client)

    admin_email = "admin@gmail.com"
    admin_password = "12345678"

    # Check if admin already exists
    try:
        existing = (
            client.table("profiles").select("id").eq("role", "admin").execute()
        )
        if existing.data:
            print(f"Admin already seeded (id: {existing.data[0]['id']})")
            return
    except Exception as e:
        print(f"Note: {e}")
        print("Tables may not exist yet. Attempting to create user anyway...")

    try:
        # Create user via Supabase Auth admin API
        resp = client.auth.admin.create_user(
            {
                "email": admin_email,
                "password": admin_password,
                "email_confirm": True,
            }
        )
        user_id = resp.user.id
        print(f"Created auth user: {user_id}")

        # Create profiles row
        client.table("profiles").insert(
            {"id": user_id, "role": "admin"}
        ).execute()
        print(f"Created admin profile for {admin_email}")

        print("\n✓ Admin seeded successfully!")
        print(f"  Email: {admin_email}")
        print(f"  Password: {admin_password}")

    except Exception as e:
        error_str = str(e)
        if "already exists" in error_str.lower() or "duplicate" in error_str.lower():
            print(f"Admin user already exists. No changes made.")
        else:
            print(f"ERROR: {e}")


if __name__ == "__main__":
    seed_admin()
