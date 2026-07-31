from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.core.supabase_client import get_supabase_anon
from app.models.schemas import LoginRequest, LoginResponse, CurrentUser

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
async def login(credentials: LoginRequest):
    """Authenticate with email/password via Supabase Auth and return a bearer token.

    Use the returned access_token as the HTTP Bearer token for protected endpoints.
    """
    sb = get_supabase_anon()

    try:
        resp = sb.auth.sign_in_with_password(
            {"email": credentials.email, "password": credentials.password}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid credentials: {str(e)}",
        )

    if not resp.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user = resp.user
    metadata = user.user_metadata or {}

    # Load the role from the profiles table (service role lookup)
    from app.core.supabase_client import get_supabase_service

    profile = None
    try:
        profile_resp = (
            get_supabase_service()
            .table("profiles")
            .select("role, full_name, avatar_url")
            .eq("id", user.id)
            .maybe_single()
            .execute()
        )
        profile = profile_resp.data if profile_resp else None
    except Exception:
        profile = None

    return LoginResponse(
        access_token=resp.session.access_token,
        expires_in=resp.session.expires_in,
        user=CurrentUser(
            id=user.id,
            email=user.email or credentials.email,
            role=(profile or {}).get("role", "candidate"),
            full_name=(profile or {}).get("full_name")
            or metadata.get("full_name")
            or "",
            avatar_url=(profile or {}).get("avatar_url")
            or metadata.get("avatar_url")
            or "",
        ),
    )
