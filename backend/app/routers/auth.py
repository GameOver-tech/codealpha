from fastapi import APIRouter, Depends, HTTPException, status
from app.models.schemas import AdminLoginRequest, SessionResponse
from app.middleware.auth import get_current_user
from app.services.supabase_service import get_supabase_service, ensure_candidate_profile

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/verify")
async def validate_session(user: dict = Depends(get_current_user)) -> SessionResponse:
    """Validate JWT and return user info with role. Auto-creates candidate profile on first login."""
    supabase = get_supabase_service()
    profile = supabase.table("profiles").select("role").eq("id", user["id"]).execute()

    if not profile.data:
        # First-time login — create profile and candidate row
        meta = user.get("user_metadata", {})
        full_name = meta.get("full_name", meta.get("name", user.get("email", "")))
        email = user.get("email", "")
        photo_url = meta.get("avatar_url", meta.get("picture", None))
        await ensure_candidate_profile(user["id"], full_name, email, photo_url)
        profile = supabase.table("profiles").select("role").eq("id", user["id"]).execute()

    role = profile.data[0]["role"] if profile.data else "candidate"

    # Get candidate details if candidate
    candidate_data = None
    if role == "candidate":
        candidate = supabase.table("candidates").select("*").eq("id", user["id"]).execute()
        if candidate.data:
            candidate_data = candidate.data[0]

    return SessionResponse(
        id=user["id"],
        email=user.get("email", ""),
        role=role,
        full_name=candidate_data.get("full_name") if candidate_data else None,
        photo_url=candidate_data.get("photo_url") if candidate_data else None,
    )


@router.post("/admin-login")
async def admin_login(request: AdminLoginRequest) -> dict:
    """Admin login with email and password via Supabase Auth."""
    supabase = get_supabase_service()
    try:
        response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
        user = response.user
        session = response.session

        # Verify the user has admin role
        profile = supabase.table("profiles").select("role").eq("id", user.id).execute()
        if not profile.data or profile.data[0]["role"] != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized as admin",
            )

        return {
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": "admin",
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid credentials: {str(e)}",
        )
