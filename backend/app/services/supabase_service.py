from supabase import create_client, Client
from app.config import settings

_supabase_anon: Client | None = None
_supabase_service: Client | None = None


def get_supabase() -> Client:
    global _supabase_anon
    if _supabase_anon is None:
        _supabase_anon = create_client(
            settings.supabase_url, settings.supabase_anon_key
        )
    return _supabase_anon


def get_supabase_service() -> Client:
    global _supabase_service
    if _supabase_service is None:
        _supabase_service = create_client(
            settings.supabase_url, settings.supabase_service_role_key
        )
    return _supabase_service


async def create_candidate_profile(user_id: str, full_name: str, email: str, photo_url: str | None = None):
    client = get_supabase_service()
    client.table("profiles").upsert({
        "id": user_id,
        "role": "candidate"
    }).execute()
    client.table("candidates").upsert({
        "id": user_id,
        "full_name": full_name,
        "email": email,
        "photo_url": photo_url
    }).execute()


async def ensure_candidate_profile(user_id: str, full_name: str, email: str, photo_url: str | None = None):
    client = get_supabase_service()
    existing = client.table("candidates").select("*").eq("id", user_id).execute()
    if not existing.data:
        await create_candidate_profile(user_id, full_name, email, photo_url)
        existing = client.table("candidates").select("*").eq("id", user_id).execute()
    return existing.data[0] if existing.data else None
