"""
Auth router — endpoints shared between secure and insecure modes.

Logout and account deletion use both flavours via explicit query param
so the frontend can demonstrate the difference side by side.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.utils import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models import Classroom, ClassroomStudent, Mark, TokenBlacklist, UploadSession, User
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

bearer_scheme = HTTPBearer()


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if body.role not in ("student", "teacher", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token, _jti, _exp = create_access_token(str(user.id), user.role)
    return TokenResponse(access_token=token)


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token, _jti, _exp = create_access_token(str(user.id), user.role)
    return TokenResponse(access_token=token)


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(
    mode: str = Query(default="secure", pattern="^(secure|insecure)$"),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    secure  → WITH FRICTION (SECURE): blacklists the jti so the token is dead immediately.
    insecure → NO FRICTION (VULNERABLE): does nothing — token remains valid until expiry.
    """
    if mode == "insecure":
        # NO FRICTION (VULNERABLE): logout is a no-op — token still works
        return {"detail": "Logged out (token still valid until expiry — insecure mode)"}

    # WITH FRICTION (SECURE): decode and blacklist the jti
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    jti = payload.get("jti")
    user_id = payload.get("sub")
    exp = payload.get("exp")
    expires_at = datetime.utcfromtimestamp(exp)

    # Check not already blacklisted (idempotent)
    existing = await db.execute(select(TokenBlacklist).where(TokenBlacklist.jti == jti))
    if not existing.scalar_one_or_none():
        db.add(TokenBlacklist(user_id=user_id, jti=jti, expires_at=expires_at))
        await db.commit()

    return {"detail": "Logged out — token revoked immediately"}


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
async def me(
    mode: str = Query(default="secure", pattern="^(secure|insecure)$"),
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    """Returns current user. Uses secure or insecure dependency based on mode."""
    if mode == "insecure":
        # NO FRICTION (VULNERABLE): no blacklist / active check
        try:
            payload = decode_token(credentials.credentials)
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")
        result = await db.execute(select(User).where(User.id == payload["sub"]))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    # WITH FRICTION (SECURE)
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    jti = payload.get("jti")
    user_id = payload.get("sub")

    bl = await db.execute(
        select(TokenBlacklist).where(
            TokenBlacklist.jti == jti,
            TokenBlacklist.expires_at > datetime.utcnow(),
        )
    )
    if bl.scalar_one_or_none():
        raise HTTPException(status_code=401, detail="Token has been revoked")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


# ── Delete account ────────────────────────────────────────────────────────────

@router.delete("/me")
async def delete_me(
    mode: str = Query(default="secure", pattern="^(secure|insecure)$"),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    secure  → WITH FRICTION (SECURE): hard-deletes user and blacklists token jti.
    insecure → NO FRICTION (VULNERABLE): hard-deletes user but does NOT blacklist
               the current token.
    """
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Hard-delete dependent records first to satisfy foreign keys.
    taught_classroom_ids = (
        await db.execute(select(Classroom.id).where(Classroom.teacher_id == user.id))
    ).scalars().all()

    if taught_classroom_ids:
        await db.execute(
            delete(ClassroomStudent).where(ClassroomStudent.classroom_id.in_(taught_classroom_ids))
        )
        await db.execute(delete(Mark).where(Mark.classroom_id.in_(taught_classroom_ids)))
        await db.execute(
            delete(UploadSession).where(UploadSession.classroom_id.in_(taught_classroom_ids))
        )
        await db.execute(delete(Classroom).where(Classroom.id.in_(taught_classroom_ids)))

    # Remove records where the user is a student/uploader/token owner.
    await db.execute(delete(ClassroomStudent).where(ClassroomStudent.student_id == user.id))
    await db.execute(delete(Mark).where(Mark.student_id == user.id))
    await db.execute(delete(UploadSession).where(UploadSession.user_id == user.id))
    await db.execute(delete(TokenBlacklist).where(TokenBlacklist.user_id == user.id))

    # Remove the user row itself.
    await db.delete(user)

    if mode == "insecure":
        # NO FRICTION (VULNERABLE): no token revocation record is created.
        await db.commit()
        return {"detail": "Account deleted permanently (token not revoked — insecure mode)"}

    # WITH FRICTION (SECURE): revoke the token immediately (without FK to deleted user)
    jti = payload.get("jti")
    exp = payload.get("exp")
    expires_at = datetime.utcfromtimestamp(exp)
    existing = await db.execute(select(TokenBlacklist).where(TokenBlacklist.jti == jti))
    if not existing.scalar_one_or_none():
        db.add(TokenBlacklist(user_id=None, jti=jti, expires_at=expires_at))
    await db.commit()

    return {"detail": "Account deleted permanently and token revoked immediately"}
