import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_role
from app.models import Classroom, ClassroomStudent, Mark, TokenBlacklist, User
from app.schemas import AdminUserUpdateRequest, UserOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: list all users."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


@router.get("/users/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: fetch a single user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    body: AdminUserUpdateRequest,
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin-only user management endpoint:
    - update role
    - update active status
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.role is not None:
        if body.role not in ("student", "teacher", "admin"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")
        user.role = body.role

    if body.is_active is not None:
        user.is_active = body.is_active

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    _admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: hard delete user."""
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
    return {"detail": "User deleted successfully"}
