"""
WITH FRICTION (SECURE) — File upload and access endpoints.

POST /api/secure/files/upload-request
POST /api/secure/files/upload-confirm
Schedule is unified at: POST /api/files/schedule
Download is unified at: GET /api/files/{file_id}?mode=secure

Friction layers applied:
  1. Backend file_id mapping + deterministic filename key.
  2. 7-day upload URL validity.
  3. Schedule-based visibility via file_schedules.
  4. Content hash captured on confirm; verified on secure download.
"""

import uuid

import boto3
from botocore.config import Config
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user_secure
from app.models import Classroom, File, User
from app.schemas import (
    FileUploadRequestResponse,
    SecureFileUploadConfirmRequest,
    SecureFileUploadRequest,
)

router = APIRouter(prefix="/api/secure/files", tags=["secure-files"])

# WITH FRICTION (SECURE): 7-day upload URL (integrity checked by hash)
_SECURE_EXPIRY = 7 * 24 * 3600


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


@router.post("/upload-request", response_model=FileUploadRequestResponse)
async def upload_request_secure(
    body: SecureFileUploadRequest,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    if not body.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pdf filename is allowed")

    classroom = (
        await db.execute(select(Classroom).where(Classroom.id == body.classroom_id))
    ).scalar_one_or_none()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    if current_user.role == "teacher" and classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this classroom")

    file_id = uuid.uuid4()
    safe_filename = body.filename.replace("/", "_").replace("\\", "_")
    key = f"submissions/{body.classroom_id}/{safe_filename}"

    s3 = _get_s3_client()
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key, "ContentType": "application/pdf"},
        ExpiresIn=_SECURE_EXPIRY,
    )

    file_record = File(
        file_id=file_id,
        owner_id=current_user.id,
        classroom_id=body.classroom_id,
        temp_key=key,
        status="draft",
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)

    return FileUploadRequestResponse(
        file_id=file_record.file_id,
        upload_url=upload_url,
        key=key,
        expires_in=_SECURE_EXPIRY,
    )


@router.post("/upload-confirm")
async def upload_confirm_secure(
    body: SecureFileUploadConfirmRequest,
    current_user: User = Depends(get_current_user_secure),
    db: AsyncSession = Depends(get_db),
):
    file_record = (
        await db.execute(select(File).where(File.file_id == body.file_id))
    ).scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    if file_record.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this file",
        )
    s3 = _get_s3_client()
    try:
        obj = s3.head_object(Bucket=settings.R2_BUCKET_NAME, Key=file_record.temp_key)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded object not found")

    etag = (obj.get("ETag") or "").replace('"', "")
    if not etag:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to compute file hash")

    file_record.final_key = file_record.temp_key
    file_record.content_hash = etag
    file_record.status = "draft"
    await db.commit()
    return {"detail": "Upload confirmed", "file_id": str(file_record.file_id)}


