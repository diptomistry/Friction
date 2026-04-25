import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_secure
from app.models import Classroom, ClassroomStudent, Mark, TokenBlacklist, User

router = APIRouter(prefix="/api/secure/admin", tags=["secure-admin"])


def _user_revocation_jti(user_id: uuid.UUID) -> str:
    return f"revoked-user:{user_id}"


@router.delete("/users/{user_id}")
async def delete_user_secure(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    """
    WITH FRICTION (SECURE):
    - Admin hard-deletes a user.
    - Adds a revocation marker so secure auth rejects tokens issued for that deleted user.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    taught_classroom_ids = (
        await db.execute(select(Classroom.id).where(Classroom.teacher_id == user.id))
    ).scalars().all()

    if taught_classroom_ids:
        await db.execute(
            delete(ClassroomStudent).where(ClassroomStudent.classroom_id.in_(taught_classroom_ids))
        )
        await db.execute(delete(Mark).where(Mark.classroom_id.in_(taught_classroom_ids)))
        await db.execute(delete(Classroom).where(Classroom.id.in_(taught_classroom_ids)))

    await db.execute(delete(ClassroomStudent).where(ClassroomStudent.student_id == user.id))
    await db.execute(delete(Mark).where(Mark.student_id == user.id))
    await db.execute(delete(TokenBlacklist).where(TokenBlacklist.user_id == user.id))
    await db.delete(user)

    # Keep marker lifetime aligned with token max lifetime window.
    marker_expiry = datetime.utcnow() + timedelta(days=7)
    db.add(
        TokenBlacklist(
            user_id=None,
            jti=_user_revocation_jti(user_id),
            expires_at=marker_expiry,
        )
    )

    await db.commit()
    return {"detail": "User deleted successfully (secure: revocation marker added)"}
