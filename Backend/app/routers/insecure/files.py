"""
NO FRICTION (VULNERABLE) — legacy file storage system.

POST /api/insecure/files/upload-url
POST /api/insecure/files/confirm
Download is unified at: GET /api/files/{file_id}?mode=insecure

Vulnerability focus:
  - User controls storage key (overwrite / predictability risk).
  - No ownership check on download access (handled by unified endpoint).

Global rule still enforced:
  - Download schedule rule is enforced by unified endpoint.
"""

import boto3
from botocore.config import Config
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user_insecure
from app.models import File, User
from app.schemas import InsecureFileConfirmRequest, InsecureFileUploadUrlRequest, UploadUrlResponse

router = APIRouter(prefix="/api/insecure/files", tags=["insecure-files"])

# 7-day expiry — NO FRICTION (VULNERABLE)
_INSECURE_EXPIRY = 7 * 24 * 3600


def _get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


@router.post("/upload-url", response_model=UploadUrlResponse)
async def get_insecure_upload_url(
    body: InsecureFileUploadUrlRequest,
    # NO FRICTION (VULNERABLE): insecure auth — blacklisted tokens accepted
    current_user: User = Depends(get_current_user_insecure),
):
    """
    NO FRICTION (VULNERABLE):
    - key is entirely user-controlled → path traversal possible.
    - Expiry is 7 days → long attack window.
    - No content-type restriction → any file type can be uploaded.
    - No size restriction → DoS via large file upload.
    """
    s3 = _get_s3_client()

    # NO FRICTION (VULNERABLE): sign whatever key the user provides
    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": body.key},
        ExpiresIn=_INSECURE_EXPIRY,
    )

    return UploadUrlResponse(
        upload_url=upload_url,
        key=body.key,
        expires_in=_INSECURE_EXPIRY,
    )


@router.post("/confirm")
async def confirm_insecure_upload(
    body: InsecureFileConfirmRequest,
    current_user: User = Depends(get_current_user_insecure),
    db: AsyncSession = Depends(get_db),
):
    """
    Legacy confirm:
    - Stores user-provided key directly in DB.
    """
    file_record = File(
        owner_id=current_user.id,
        classroom_id=body.classroom_id,
        temp_key=body.key,
        final_key=body.key,
        status="scheduled",
    )
    db.add(file_record)
    await db.commit()
    await db.refresh(file_record)
    return {"detail": "Upload confirmed", "file_id": str(file_record.file_id)}


