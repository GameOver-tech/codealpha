from supabase import create_client, Client

from app.core.config import settings

supabase_anon: Client | None = None
supabase_service: Client | None = None


def get_supabase_anon() -> Client:
    global supabase_anon
    if supabase_anon is None:
        supabase_anon = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY
        )
    return supabase_anon


def get_supabase_service() -> Client:
    global supabase_service
    if supabase_service is None:
        supabase_service = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
        )
    return supabase_service
