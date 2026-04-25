import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_secure
from app.models import StudentNotice, User
from app.schemas import StudentNoticeCreateRequest, StudentNoticeOut, StudentNoticeUpdateRequest

router = APIRouter(prefix="/api/notices", tags=["notices"])


@router.get("", response_model=list[StudentNoticeOut])
async def list_notices(
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    """
    Global student notices feed.
    - student: only published notices
    - teacher/admin: all notices (draft + published)
    """
    query = select(StudentNotice).order_by(StudentNotice.created_at.desc())
    if current_user.role == "student":
        query = query.where(StudentNotice.is_published.is_(True))
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("", response_model=StudentNoticeOut, status_code=status.HTTP_201_CREATED)
async def create_notice(
    body: StudentNoticeCreateRequest,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can create notices")

    notice = StudentNotice(
        title=body.title,
        body=body.body,
        created_by=current_user.id,
        is_published=body.is_published,
    )
    db.add(notice)
    await db.commit()
    await db.refresh(notice)
    return notice


@router.patch("/{notice_id}", response_model=StudentNoticeOut)
async def update_notice(
    notice_id: uuid.UUID,
    body: StudentNoticeUpdateRequest,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can update notices")

    notice = (await db.execute(select(StudentNotice).where(StudentNotice.id == notice_id))).scalar_one_or_none()
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")

    if body.title is not None:
        notice.title = body.title
    if body.body is not None:
        notice.body = body.body
    if body.is_published is not None:
        notice.is_published = body.is_published

    await db.commit()
    await db.refresh(notice)
    return notice


@router.delete("/{notice_id}")
async def delete_notice(
    notice_id: uuid.UUID,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can delete notices")

    notice = (await db.execute(select(StudentNotice).where(StudentNotice.id == notice_id))).scalar_one_or_none()
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")

    await db.delete(notice)
    await db.commit()
    return {"detail": "Notice deleted"}
