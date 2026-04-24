import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


# ── Auth ─────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str  # student | teacher | admin


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserUpdateRequest(BaseModel):
    role: Optional[str] = None  # student | teacher | admin
    is_active: Optional[bool] = None


# ── Marks ─────────────────────────────────────────────────────────────────────

class MarkUpdateRequest(BaseModel):
    student_id: uuid.UUID
    classroom_id: uuid.UUID
    marks: int


class MarkOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    classroom_id: uuid.UUID
    marks: int
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Files ─────────────────────────────────────────────────────────────────────

class UploadUrlResponse(BaseModel):
    upload_url: str
    key: str
    expires_in: int


class SecureUploadUrlResponse(BaseModel):
    upload_url: str
    key: str
    session_id: uuid.UUID
    expires_in: int


class FileUrlResponse(BaseModel):
    download_url: str
    expires_in: int
