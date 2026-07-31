import base64
import time

import httpx
import jwt as pyjwt
from fastapi import HTTPException, status
from app.core.config import settings

# Cache the fetched JWKS for a while (keys rotate rarely)
_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0
JWKS_CACHE_TTL = 3600  # 1 hour


def _get_jwt_secret() -> str:
    """Return the JWT secret, decoding base64 if it looks encoded.

    Newer Supabase projects expose a base64-encoded 64-byte secret.
    PyJWT needs the raw bytes; base64-decode it when it's valid base64.
    """
    secret = settings.SUPABASE_JWT_SECRET
    try:
        # If it's valid base64 of 32+ bytes, decode to raw bytes
        decoded = base64.b64decode(secret, validate=True)
        if len(decoded) >= 32:
            return decoded
    except Exception:
        pass
    # Plain-text secret (older projects)
    return secret


def _fetch_jwks() -> dict:
    """Fetch the project's signing keys from the auth JWKS endpoint."""
    global _jwks_cache, _jwks_fetched_at

    now = time.time()
    if _jwks_cache and (now - _jwks_fetched_at) < JWKS_CACHE_TTL:
        return _jwks_cache

    url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    _jwks_cache = resp.json()
    _jwks_fetched_at = now
    return _jwks_cache


def _get_es256_public_key(kid: str) -> str:
    """Build an ES256 public key (PEM) from the JWKS 'x'/'y' coordinates."""
    try:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives import serialization
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="cryptography package is required for ES256 JWT verification",
        )

    jwks = _fetch_jwks()
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if not key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unknown signing key id in token",
        )

    # Decode base64url x and y coordinates
    pad = lambda s: s + "=" * (-len(s) % 4)
    x = base64.urlsafe_b64decode(pad(key["x"]))
    y = base64.urlsafe_b64decode(pad(key["y"]))

    public_numbers = ec.EllipticCurvePublicNumbers(
        int.from_bytes(x, "big"), int.from_bytes(y, "big"), ec.SECP256R1()
    )
    public_key = public_numbers.public_key()
    pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return pem.decode("utf-8")


def verify_jwt(token: str) -> dict:
    """Verify a Supabase JWT and return its payload.

    Supports both:
    - HS256 (legacy projects): signed with SUPABASE_JWT_SECRET
    - ES256 (newer projects): verified against the public key fetched from
      the project's JWKS endpoint (no extra config needed)
    """
    # Peek at the token header to pick the right algorithm
    try:
        unverified_header = pyjwt.get_unverified_header(token)
    except pyjwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    alg = unverified_header.get("alg", "HS256")

    try:
        if alg == "ES256":
            kid = unverified_header.get("kid", "")
            public_key = _get_es256_public_key(kid)
            payload = pyjwt.decode(
                token,
                public_key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        else:
            payload = pyjwt.decode(
                token,
                _get_jwt_secret(),
                algorithms=["HS256"],
                audience="authenticated",
            )
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except HTTPException:
        raise
    except pyjwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify authentication token",
        )
