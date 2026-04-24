"""
Auth dependencies — two flavours:

  get_current_user_insecure  →  NO FRICTION (VULNERABLE)
      Decodes JWT, returns user. No blacklist check. Deleted users still valid.

  get_current_user_secure    →  WITH FRICTION (SECURE)
      Decodes JWT, checks blacklist, verifies user is still active.
"""

from datetime import datetime

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.utils import decode_token
from app.database import get_db
from app.models import TokenBlacklist, User

bearer_scheme = HTTPBearer()


async def _extract_payload(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """Shared helper: decode the raw JWT and return its payload."""
    try:
        return decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# ── NO FRICTION (VULNERABLE) ──────────────────────────────────────────────────

async def get_current_user_insecure(
    payload: dict = Depends(_extract_payload),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    NO FRICTION (VULNERABLE):
    - Accepts any non-expired JWT.
    - Does NOT check the token blacklist.
    - Returns the user even if they have been deleted / deactivated.
    """
    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    # NO blacklist check — token remains valid until natural expiry
    return user


# ── WITH FRICTION (SECURE) ────────────────────────────────────────────────────

async def get_current_user_secure(
    payload: dict = Depends(_extract_payload),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    WITH FRICTION (SECURE):
    - Checks token jti against the blacklist (catches logged-out / deleted tokens).
    - Verifies the user account is still active.
    """
    jti = payload.get("jti")
    user_id = payload.get("sub")

    # Friction point 1: reject blacklisted tokens immediately
    bl_result = await db.execute(
        select(TokenBlacklist).where(
            TokenBlacklist.jti == jti,
            TokenBlacklist.expires_at > datetime.utcnow(),
        )
    )
    if bl_result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Friction point 2: reject deactivated / deleted users
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


# ── Role helpers ──────────────────────────────────────────────────────────────

def require_role(*roles: str):
    """Factory: returns a dependency that asserts the user's role."""

    async def _check(user: User = Depends(get_current_user_secure)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {roles}",
            )
        return user

    return _check
