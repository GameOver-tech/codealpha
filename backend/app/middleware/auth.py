from fastapi import Depends, HTTPException, Header, status
from supabase import Client
from app.services.supabase_service import get_supabase, get_supabase_service


async def get_token_from_header(authorization: str = Header(None)) -> str:
    """Extract Bearer token from Authorization header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Use: Bearer <token>",
        )
    return token


async def get_current_user(token: str = Depends(get_token_from_header)) -> dict:
    """Validate Supabase JWT and return the user object."""
    supabase: Client = get_supabase()
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        return {"id": user_response.user.id, "email": user_response.user.email or "", "user_metadata": user_response.user.user_metadata}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )


def _get_role(user_id: str) -> str | None:
    """Get role using service client (bypasses RLS to avoid infinite recursion)."""
    svc = get_supabase_service()
    profile = svc.table("profiles").select("role").eq("id", user_id).execute()
    return profile.data[0]["role"] if profile.data else None


async def get_current_candidate(user: dict = Depends(get_current_user)) -> dict:
    """Verify the user has the candidate role."""
    role = _get_role(user["id"])
    if role != "candidate":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Candidate access required",
        )
    return user


async def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    """Verify the user has the admin role."""
    role = _get_role(user["id"])
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
