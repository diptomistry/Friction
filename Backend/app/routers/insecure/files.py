"""
NO FRICTION (VULNERABLE) — File upload and access endpoints.

GET /api/insecure/upload-url?key=<user_input>
GET /api/insecure/file-url?key=<user_input>

Vulnerabilities demonstrated:
  1. User controls the S3 key — path traversal / overwrite any object.
  2. Pre-signed URL valid for 7 days.
  3. No content-type or size restrictions enforced.
  4. file-url signs any arbitrary key — no ownership check.
"""

import boto3
from botocore.config import Config
from fastapi import APIRouter, Depends, Query

from app.config import settings
from app.dependencies import get_current_user_insecure
from app.models import User
from app.schemas import FileUrlResponse, UploadUrlResponse

router = APIRouter(prefix="/api/insecure", tags=["insecure-files"])

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


@router.get("/upload-url", response_model=UploadUrlResponse)
async def get_insecure_upload_url(
    key: str = Query(..., description="User-supplied S3 key — no sanitisation"),
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
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
        ExpiresIn=_INSECURE_EXPIRY,
    )

    return UploadUrlResponse(
        upload_url=upload_url,
        key=key,
        expires_in=_INSECURE_EXPIRY,
    )


@router.get("/file-url", response_model=FileUrlResponse)
async def get_insecure_file_url(
    key: str = Query(..., description="Any S3 key — no ownership check"),
    # NO FRICTION (VULNERABLE): insecure auth
    current_user: User = Depends(get_current_user_insecure),
):
    """
    NO FRICTION (VULNERABLE):
    - No ownership check — any authenticated user can access any object.
    - key is user-controlled → read any object in the bucket.
    """
    s3 = _get_s3_client()

    # NO FRICTION (VULNERABLE): sign any key, no ownership validation
    download_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
        ExpiresIn=_INSECURE_EXPIRY,
    )

    return FileUrlResponse(download_url=download_url, expires_in=_INSECURE_EXPIRY)
