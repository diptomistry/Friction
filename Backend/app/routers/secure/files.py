"""
WITH FRICTION (SECURE) — File upload and access endpoints.

GET /api/secure/upload-url
GET /api/secure/file-url?session_id=<uuid>

Friction layers applied:
  1. Server-generated key — user cannot control the path.
  2. Short-lived pre-signed URL (300 seconds).
  3. Content-type locked to application/pdf.
  4. Max 5 MB enforced via Conditions in pre-signed POST.
  5. Upload session stored in DB for ownership tracking.
  6. file-url validates session ownership and expiry.
  7. Teachers can access files from their own classrooms.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional

import boto3
from botocore.config import Config
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user_secure
from app.models import Classroom, ClassroomStudent, UploadSession, User
from app.schemas import FileUrlResponse, SecureUploadUrlResponse

router = APIRouter(prefix="/api/secure", tags=["secure-files"])

# WITH FRICTION (SECURE): short expiry
_SECURE_EXPIRY = 300  # 5 minutes
_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_CONTENT_TYPE = "application/pdf"


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


@router.get("/upload-url", response_model=SecureUploadUrlResponse)
async def get_secure_upload_url(
    classroom_id: Optional[uuid.UUID] = Query(default=None),
    # WITH FRICTION (SECURE): secure auth dependency
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    """
    WITH FRICTION (SECURE):
    - Server generates a fixed-format key → no path traversal.
    - Expiry: 300 seconds.
    - Content-type enforced to application/pdf.
    - Max 5 MB via presigned POST conditions.
    - Upload session recorded in DB for later ownership validation.
    """

    # Friction point 1: server-controlled key — user cannot influence the path
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    file_uuid = str(uuid.uuid4())
    key = f"submissions/{current_user.id}/{file_uuid}/{timestamp}.pdf"

    expires_at = datetime.utcnow() + timedelta(seconds=_SECURE_EXPIRY)

    s3 = _get_s3_client()

    # Friction point 2: presigned POST with conditions (size + content-type)
    presigned = s3.generate_presigned_post(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Fields={"Content-Type": _ALLOWED_CONTENT_TYPE},
        Conditions=[
            {"Content-Type": _ALLOWED_CONTENT_TYPE},          # lock content-type
            ["content-length-range", 1, _MAX_SIZE_BYTES],     # max 5 MB
        ],
        ExpiresIn=_SECURE_EXPIRY,
    )

    # Friction point 3: persist session for ownership validation at download time
    session = UploadSession(
        user_id=current_user.id,
        file_key=key,
        classroom_id=classroom_id,
        expires_at=expires_at,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return SecureUploadUrlResponse(
        upload_url=presigned["url"],
        key=key,
        session_id=session.id,
        expires_in=_SECURE_EXPIRY,
    )


@router.get("/file-url", response_model=FileUrlResponse)
async def get_secure_file_url(
    session_id: uuid.UUID = Query(...),
    # WITH FRICTION (SECURE): secure auth dependency
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    """
    WITH FRICTION (SECURE):
    - Looks up upload session by session_id.
    - Validates session expiry.
    - Validates ownership: requester must be the uploader OR a teacher who owns the
      classroom linked to the session.
    - Signs a short-lived (300 s) URL — not an arbitrary key.
    """

    # Friction point 1: session must exist
    result = await db.execute(
        select(UploadSession).where(UploadSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload session not found")

    # Friction point 2: session expiry check
    if session.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Upload session has expired",
        )

    # Friction point 3: ownership check
    is_owner = session.user_id == current_user.id

    is_classroom_teacher = False
    if not is_owner and current_user.role == "teacher" and session.classroom_id:
        classroom_result = await db.execute(
            select(Classroom).where(
                Classroom.id == session.classroom_id,
                Classroom.teacher_id == current_user.id,
            )
        )
        is_classroom_teacher = classroom_result.scalar_one_or_none() is not None

    if not is_owner and not is_classroom_teacher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this file",
        )

    s3 = _get_s3_client()

    # Friction point 4: short-lived URL, key comes from DB — not user input
    download_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": session.file_key},
        ExpiresIn=_SECURE_EXPIRY,
    )

    return FileUrlResponse(download_url=download_url, expires_in=_SECURE_EXPIRY)
