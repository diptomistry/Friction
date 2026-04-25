"""
WITH FRICTION (SECURE) — Marks endpoint.

PUT /api/secure/marks/update

Friction layers applied:
  1. Role enforcement — only teachers can update marks.
  2. Classroom ownership check — teacher must own the classroom.
  3. Student membership check — student must belong to that classroom.
  4. Secure auth dependency — blacklisted / inactive tokens rejected.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_secure
from app.models import Classroom, ClassroomStudent, File, Mark, User
from app.schemas import MarkOut, MarkUpdateRequest

router = APIRouter(prefix="/api/secure/marks", tags=["secure-marks"])


@router.put("/update", response_model=MarkOut)
async def update_marks_secure(
    body: MarkUpdateRequest,
    # WITH FRICTION (SECURE): uses secure dependency — blacklist + active check
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    """
    WITH FRICTION (SECURE):
    - Only users with role 'teacher' may proceed.
    - The teacher must own the target classroom.
    - The student must be enrolled in that classroom.
    """

    # Friction point 1: role enforcement
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can update marks",
        )

    # Friction point 2: classroom ownership
    classroom_result = await db.execute(
        select(Classroom).where(Classroom.id == body.classroom_id)
    )
    classroom = classroom_result.scalar_one_or_none()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if classroom.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this classroom",
        )

    # Friction point 3: student membership
    membership_result = await db.execute(
        select(ClassroomStudent).where(
            ClassroomStudent.classroom_id == body.classroom_id,
            ClassroomStudent.student_id == body.student_id,
        )
    )
    if not membership_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is not enrolled in this classroom",
        )

    # Friction point 4: file belongs to the same classroom
    file_result = await db.execute(
        select(File).where(File.file_id == body.file_id)
    )
    file_row = file_result.scalar_one_or_none()
    if not file_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if file_row.classroom_id != body.classroom_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File does not belong to the provided classroom",
        )

    # All friction checks passed — perform the upsert
    result = await db.execute(
        select(Mark).where(
            Mark.student_id == body.student_id,
            Mark.classroom_id == body.classroom_id,
            Mark.file_id == body.file_id,
        )
    )
    mark = result.scalar_one_or_none()

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
