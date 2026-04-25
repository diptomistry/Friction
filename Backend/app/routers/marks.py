"""
Standard marks APIs used by frontend role-based views.

GET /api/marks
  - student: returns only own marks
  - teacher: returns all marks for classrooms they own
  - admin: returns all marks

PUT /api/marks/update
  - teacher-only mark upsert with classroom ownership and enrollment checks
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_secure
from app.models import Classroom, ClassroomStudent, File, Mark, User
from app.schemas import MarkOut, MarkUpdateRequest

router = APIRouter(prefix="/api/marks", tags=["marks"])


@router.get("", response_model=list[MarkOut])
async def get_marks(
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "student":
        result = await db.execute(
            select(Mark).where(
                Mark.student_id == current_user.id,
                Mark.file_id.is_not(None),
            )
        )
        return list(result.scalars().all())

    if current_user.role == "teacher":
        classroom_ids = (
            await db.execute(select(Classroom.id).where(Classroom.teacher_id == current_user.id))
        ).scalars().all()
        if not classroom_ids:
            return []
        result = await db.execute(
            select(Mark).where(
                Mark.classroom_id.in_(classroom_ids),
                Mark.file_id.is_not(None),
            )
        )
        return list(result.scalars().all())

    # admin
    result = await db.execute(select(Mark).where(Mark.file_id.is_not(None)))
    return list(result.scalars().all())


@router.put("/update", response_model=MarkOut)
async def update_marks(
    body: MarkUpdateRequest,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    # teacher can edit marks
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can update marks",
        )

    classroom = (
        await db.execute(select(Classroom).where(Classroom.id == body.classroom_id))
    ).scalar_one_or_none()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    if classroom.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this classroom",
        )

    membership = (
        await db.execute(
            select(ClassroomStudent).where(
                ClassroomStudent.classroom_id == body.classroom_id,
                ClassroomStudent.student_id == body.student_id,
            )
        )
    ).scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is not enrolled in this classroom",
        )

    file_row = (
        await db.execute(select(File).where(File.file_id == body.file_id))
    ).scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if file_row.classroom_id != body.classroom_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File does not belong to the provided classroom",
        )

    mark = (
        await db.execute(
            select(Mark).where(
                Mark.student_id == body.student_id,
                Mark.classroom_id == body.classroom_id,
                Mark.file_id == body.file_id,
            )
        )
    ).scalar_one_or_none()

    if mark:
        mark.marks = body.marks
        mark.updated_at = datetime.utcnow()
    else:
        mark = Mark(
            student_id=body.student_id,
            classroom_id=body.classroom_id,
            file_id=body.file_id,
            marks=body.marks,
        )
        db.add(mark)

    await db.commit()
    await db.refresh(mark)
    return mark
