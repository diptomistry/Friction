"""
NO FRICTION (VULNERABLE) — Marks endpoint.

PUT /api/insecure/marks/update

Vulnerabilities demonstrated:
  1. No role enforcement — any authenticated user (even a student) can update marks.
  2. No classroom ownership check — a teacher from another classroom can update marks.
  3. No student membership check — marks can be set for any user/classroom pair.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_insecure
from app.models import Mark, User
from app.schemas import MarkOut, MarkUpdateRequest

router = APIRouter(prefix="/api/insecure/marks", tags=["insecure-marks"])


@router.put("/update", response_model=MarkOut)
async def update_marks_insecure(
    body: MarkUpdateRequest,
    # NO FRICTION (VULNERABLE): uses insecure dependency — no blacklist / active check
    current_user: User = Depends(get_current_user_insecure),
    db: AsyncSession = Depends(get_db),
):
    """
    NO FRICTION (VULNERABLE):
    - Zero role checks — students, teachers, and admins all reach this code.
    - No classroom ownership verification.
    - No student membership verification.
    Any authenticated user can arbitrarily set marks for any student/classroom.
    """

    # NO FRICTION (VULNERABLE): upsert marks with no authorization checks whatsoever
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
