from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.security import verify_jwt
from app.core.supabase_client import get_supabase_service
from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict:
    """Extract and verify the JWT, return user info with role from profiles."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = verify_jwt(credentials.credentials)

    sub: str = payload.get("sub") or payload.get("id")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    sb = get_supabase_service()

    # Look up profile
    resp = sb.table("profiles").select("*").eq("id", sub).maybe_single().execute()
    # maybe_single() returns None when no row matches
    profile = resp.data if resp and resp.data else None

    if profile is None:
        # Auto-create a candidate profile on first request
        email = payload.get("email", "")
        full_name = payload.get("user_metadata", {}).get("full_name", "")
        avatar_url = payload.get("user_metadata", {}).get("avatar_url", "")

        sb.table("profiles").insert(
            {
                "id": sub,
                "email": email,
                "role": "candidate",
                "full_name": full_name,
                "avatar_url": avatar_url,
            }
        ).execute()

        profile = {
            "id": sub,
            "email": email,
            "role": "candidate",
            "full_name": full_name,
            "avatar_url": avatar_url,
        }

    return {
        "id": sub,
        "email": profile.get("email", ""),
        "role": profile.get("role", "candidate"),
        "full_name": profile.get("full_name", ""),
        "avatar_url": profile.get("avatar_url", ""),
    }


def require_role(required_role: str):
    """Dependency factory: returns a dependency that checks the user's role."""

    def _role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {required_role} role",
            )
        return current_user

    return _role_checker
