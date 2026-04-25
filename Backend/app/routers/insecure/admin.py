import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_insecure
from app.models import Classroom, ClassroomStudent, Mark, TokenBlacklist, User

router = APIRouter(prefix="/api/insecure/admin", tags=["insecure-admin"])


@router.delete("/users/{user_id}")
async def delete_user_insecure(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user_insecure),
    db: AsyncSession = Depends(get_db),
):
    """
    NO FRICTION (VULNERABLE):
    - Admin hard-deletes a user.
    - Does NOT create token blacklist revocation marker for deleted user.
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
    await db.commit()
    return {"detail": "User deleted successfully (insecure: no revocation marker added)"}
