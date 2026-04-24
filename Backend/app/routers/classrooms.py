import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_secure
from app.models import Classroom, ClassroomStudent, User
from app.schemas import (
    ClassroomCreateRequest,
    ClassroomOut,
    ClassroomStudentAddRequest,
    UserOut,
)

router = APIRouter(prefix="/api/classrooms", tags=["classrooms"])


@router.get("", response_model=list[ClassroomOut])
async def list_classrooms(
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    """
    Role-based classroom listing:
    - admin: all classrooms
    - teacher: only own classrooms
    - student: only classrooms where enrolled
    """
    if current_user.role == "admin":
        result = await db.execute(select(Classroom).order_by(Classroom.created_at.desc()))
        return list(result.scalars().all())

    if current_user.role == "teacher":
        result = await db.execute(
            select(Classroom)
            .where(Classroom.teacher_id == current_user.id)
            .order_by(Classroom.created_at.desc())
        )
        return list(result.scalars().all())

    if current_user.role == "student":
        classroom_ids = (
            await db.execute(
                select(ClassroomStudent.classroom_id).where(
                    ClassroomStudent.student_id == current_user.id
                )
            )
        ).scalars().all()
        if not classroom_ids:
            return []
        result = await db.execute(
            select(Classroom)
            .where(Classroom.id.in_(classroom_ids))
            .order_by(Classroom.created_at.desc())
        )
        return list(result.scalars().all())

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unsupported role")


@router.post("", response_model=ClassroomOut, status_code=status.HTTP_201_CREATED)
async def create_classroom(
    body: ClassroomCreateRequest,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can create classrooms",
        )

    classroom = Classroom(name=body.name, teacher_id=current_user.id)
    db.add(classroom)
    await db.commit()
    await db.refresh(classroom)
    return classroom


@router.post("/{classroom_id}/students", status_code=status.HTTP_201_CREATED)
async def add_student_to_classroom(
    classroom_id: uuid.UUID,
    body: ClassroomStudentAddRequest,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can enroll students",
        )

    classroom = (
        await db.execute(select(Classroom).where(Classroom.id == classroom_id))
    ).scalar_one_or_none()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    if classroom.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this classroom",
        )

    student = (
        await db.execute(select(User).where(User.id == body.student_id))
    ).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    if student.role != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only users with role 'student' can be enrolled",
        )

    existing = (
        await db.execute(
            select(ClassroomStudent).where(
                ClassroomStudent.classroom_id == classroom_id,
                ClassroomStudent.student_id == body.student_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return {"detail": "Student already enrolled"}

    enrollment = ClassroomStudent(classroom_id=classroom_id, student_id=body.student_id)
    db.add(enrollment)
    await db.commit()
    return {"detail": "Student enrolled successfully"}


@router.get("/{classroom_id}/students", response_model=list[UserOut])
async def list_classroom_students(
    classroom_id: uuid.UUID,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    classroom = (
        await db.execute(select(Classroom).where(Classroom.id == classroom_id))
    ).scalar_one_or_none()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if current_user.role not in ("admin", "teacher"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers or admins can view classroom students",
        )

    if current_user.role == "teacher" and classroom.teacher_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this classroom",
        )

    student_ids = (
        await db.execute(
            select(ClassroomStudent.student_id).where(
                ClassroomStudent.classroom_id == classroom_id
            )
        )
    ).scalars().all()

    if not student_ids:
        return []

    students = (
        await db.execute(select(User).where(User.id.in_(student_ids)))
    ).scalars().all()
    return list(students)
