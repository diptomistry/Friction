import uuid
from datetime import datetime, timezone

import boto3
from botocore.config import Config
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.utils import decode_token
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user_secure
from app.models import (
    Classroom,
    ClassroomStudent,
    File,
    FileAccessLog,
    FileSchedule,
    TokenBlacklist,
    User,
)
from app.schemas import FileListItemResponse, FileUrlResponse, SecureFileScheduleRequest

router = APIRouter(prefix="/api/files", tags=["files"])
bearer_scheme = HTTPBearer()

_INSECURE_EXPIRY = 7 * 24 * 3600
_SECURE_EXPIRY = 7 * 24 * 3600


def _to_utc_aware(dt: datetime) -> datetime:
    """Normalize both naive and aware datetimes into UTC-aware values."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _extract_filename(file_row: File) -> str:
    key = file_row.final_key or file_row.temp_key or ""
    if "/" in key:
        return key.rsplit("/", 1)[-1]
    return key


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


async def _resolve_user_basic(
    credentials: HTTPAuthorizationCredentials,
    db: AsyncSession,
) -> User:
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = (await db.execute(select(User).where(User.id == payload.get("sub")))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def _extract_jti(credentials: HTTPAuthorizationCredentials) -> str:
    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    jti = payload.get("jti")
    if not jti:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return jti


@router.get("/classroom/{classroom_id}", response_model=list[FileListItemResponse])
async def list_classroom_files(
    classroom_id: uuid.UUID,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    classroom = (
        await db.execute(select(Classroom).where(Classroom.id == classroom_id))
    ).scalar_one_or_none()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if current_user.role == "teacher" and classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if current_user.role == "student":
        enrollment = (
            await db.execute(
                select(ClassroomStudent).where(
                    ClassroomStudent.classroom_id == classroom_id,
                    ClassroomStudent.student_id == current_user.id,
                )
            )
        ).scalar_one_or_none()
        if not enrollment:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if current_user.role in ("teacher", "admin"):
        # Teacher/Admin visibility: see all files in classroom, including future schedules.
        scheduled_file_ids = (
            await db.execute(
                select(FileSchedule.file_id).where(
                    FileSchedule.classroom_id == classroom_id,
                )
            )
        ).scalars().all()
    else:
        # Student visibility: only currently visible files.
        scheduled_file_ids = (
            await db.execute(
                select(FileSchedule.file_id).where(
                    FileSchedule.classroom_id == classroom_id,
                    FileSchedule.publish_at <= datetime.utcnow(),
                )
            )
        ).scalars().all()
    if not scheduled_file_ids:
        return []

    files = (
        await db.execute(
            select(File).where(
                File.classroom_id == classroom_id,
                File.file_id.in_(scheduled_file_ids),
            )
        )
    ).scalars().all()
    return [
        FileListItemResponse(
            file_id=file.file_id,
            classroom_id=file.classroom_id,
            status=file.status,
            publish_at=file.publish_at,
            created_at=file.created_at,
            filename=_extract_filename(file),
        )
        for file in files
    ]


@router.get("/{file_id}", response_model=FileUrlResponse)
async def get_file_url(
    file_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    current_user = await _resolve_user_basic(credentials, db)

    file_record = (await db.execute(select(File).where(File.file_id == file_id))).scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    schedule = (
        await db.execute(
            select(FileSchedule)
            .where(FileSchedule.file_id == file_record.file_id)
            .order_by(FileSchedule.publish_at.desc())
        )
    ).scalars().first()
    if not schedule:
        raise HTTPException(status_code=403, detail="File is not available yet")

    now_utc = datetime.now(timezone.utc)
    schedule_publish_utc = _to_utc_aware(schedule.publish_at)
    if now_utc < schedule_publish_utc:
        raise HTTPException(status_code=403, detail="File is not available yet")

    is_secure_file = bool(file_record.content_hash)

    if is_secure_file:
        jti = _extract_jti(credentials)
        blacklisted = await db.execute(
            select(TokenBlacklist).where(
                TokenBlacklist.jti == jti,
                TokenBlacklist.expires_at > datetime.now(timezone.utc).replace(tzinfo=None),
            )
        )
        if blacklisted.scalar_one_or_none():
            raise HTTPException(status_code=401, detail="Token has been revoked")
        if not current_user.is_active:
            raise HTTPException(status_code=403, detail="User inactive")

    if is_secure_file and current_user.role != "admin":
        if file_record.owner_id == current_user.id:
            pass
        elif current_user.role == "teacher":
            classroom = (
                await db.execute(
                    select(Classroom).where(
                        Classroom.id == file_record.classroom_id,
                        Classroom.teacher_id == current_user.id,
                    )
                )
            ).scalar_one_or_none()
            if not classroom:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user.role == "student":
            enrollment = (
                await db.execute(
                    select(ClassroomStudent).where(
                        ClassroomStudent.classroom_id == file_record.classroom_id,
                        ClassroomStudent.student_id == current_user.id,
                    )
                )
            ).scalar_one_or_none()
            if not enrollment:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            raise HTTPException(status_code=403, detail="Access denied")

    s3 = _get_s3_client()
    expires = _SECURE_EXPIRY if is_secure_file else _INSECURE_EXPIRY
    if is_secure_file:
        try:
            obj = s3.head_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=file_record.final_key or file_record.temp_key,
            )
        except Exception:
            raise HTTPException(status_code=409, detail="File object missing or inaccessible")

        current_hash = (obj.get("ETag") or "").replace('"', "")
        if not file_record.content_hash or current_hash != file_record.content_hash:
            raise HTTPException(
                status_code=409,
                detail="File integrity check failed (checksum mismatch)",
            )

    download_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": file_record.final_key or file_record.temp_key},
        ExpiresIn=expires,
    )

    db.add(FileAccessLog(file_id=file_record.file_id, user_id=current_user.id))
    await db.commit()
    return FileUrlResponse(download_url=download_url, expires_in=expires)


@router.post("/schedule")
async def schedule_file(
    body: SecureFileScheduleRequest,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    file_record = (
        await db.execute(select(File).where(File.file_id == body.file_id))
    ).scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    classroom = (
        await db.execute(select(Classroom).where(Classroom.id == file_record.classroom_id))
    ).scalar_one_or_none()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")

    if current_user.role == "teacher" and classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this classroom")
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to schedule files")

    publish_at_utc = _to_utc_aware(body.publish_at)
    schedule = FileSchedule(
        file_id=file_record.file_id,
        classroom_id=file_record.classroom_id,
        publish_at=publish_at_utc.replace(tzinfo=None),
    )
    db.add(schedule)
    # Persist as naive UTC for compatibility with timestamp/timestamptz mixed environments.
    file_record.publish_at = publish_at_utc.replace(tzinfo=None)
    file_record.status = (
        "published"
        if publish_at_utc <= datetime.now(timezone.utc)
        else "scheduled"
    )
    await db.commit()
    return {"detail": "File scheduled", "file_id": str(file_record.file_id)}
