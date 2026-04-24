# Friction Security Demo — API Documentation

> **Core concept:** Every critical feature ships in two flavours.
> - `/api/insecure/…` → **NO FRICTION (VULNERABLE)** — demonstrates what goes wrong without security controls.
> - `/api/secure/…` → **WITH FRICTION (SECURE)** — demonstrates the hardened version.
> - `/api/auth/…` → shared auth endpoints with a `?mode=` param for logout / delete.

Base URL: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

---

## Table of Contents

1. [Auth Endpoints](#1-auth-endpoints)
   - [POST /api/auth/register](#post-apiauthregister)
   - [POST /api/auth/login](#post-apiauthlogin)
   - [POST /api/auth/logout](#post-apiauthlogout)
   - [GET /api/auth/me](#get-apiauthme)
   - [DELETE /api/auth/me](#delete-apiauthme)
2. [Admin Endpoints](#2-admin-endpoints)
   - [GET /api/admin/users](#get-apiadminusers)
   - [GET /api/admin/users/{user_id}](#get-apiadminusersuser_id)
   - [PATCH /api/admin/users/{user_id}](#patch-apiadminusersuser_id)
   - [DELETE /api/admin/users/{user_id}](#delete-apiadminusersuser_id)
3. [Marks Endpoints (Role-based)](#3-marks-endpoints-role-based)
   - [GET /api/marks](#get-apimarks)
   - [PUT /api/marks/update](#put-apimarksupdate)
4. [Marks — Insecure](#4-marks--insecure)
   - [PUT /api/insecure/marks/update](#put-apiinsecuremarksupdate)
5. [Marks — Secure](#5-marks--secure)
   - [PUT /api/secure/marks/update](#put-apisecuremarksupdate)
6. [File Upload — Insecure](#6-file-upload--insecure)
   - [GET /api/insecure/upload-url](#get-apiinsecureupload-url)
   - [GET /api/insecure/file-url](#get-apiinsecurefile-url)
7. [File Upload — Secure](#7-file-upload--secure)
   - [GET /api/secure/upload-url](#get-apisecureupload-url)
   - [GET /api/secure/file-url](#get-apisecurefile-url)
8. [Friction Comparison Table](#8-friction-comparison-table)
9. [JWT Payload Reference](#9-jwt-payload-reference)
10. [Error Reference](#10-error-reference)

---

## 1. Auth Endpoints

### POST /api/auth/register

Creates a new user account and returns a JWT.

**Request body**
```json
{
  "email": "alice@example.com",
  "password": "s3cr3t",
  "role": "student"
}
```

| Field | Type | Values |
|-------|------|--------|
| `email` | string | valid email |
| `password` | string | any |
| `role` | string | `student` \| `teacher` \| `admin` |

**Response `201 Created`**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

**Errors**

| Status | Detail |
|--------|--------|
| `400` | `Email already registered` |
| `400` | `Invalid role` |

---

### POST /api/auth/login

Authenticates a user and returns a JWT.

**Request body**
```json
{
  "email": "alice@example.com",
  "password": "s3cr3t"
}
```

**Response `200 OK`**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

**Errors**

| Status | Detail |
|--------|--------|
| `401` | `Invalid credentials` |
| `403` | `Account is deactivated` |

---

### POST /api/auth/logout

**Auth:** `Bearer <token>` required  
**Query param:** `?mode=secure` (default) or `?mode=insecure`

| Mode | Behaviour |
|------|-----------|
| `insecure` | **NO FRICTION (VULNERABLE)** — no-op. Token remains valid until its 7-day natural expiry. |
| `secure` | **WITH FRICTION (SECURE)** — inserts the token's `jti` into `token_blacklist`. All subsequent requests with this token are rejected immediately. |

**Response `200 OK` — insecure**
```json
{
  "detail": "Logged out (token still valid until expiry — insecure mode)"
}
```

**Response `200 OK` — secure**
```json
{
  "detail": "Logged out — token revoked immediately"
}
```

---

### GET /api/auth/me

Returns the currently authenticated user's profile.

**Auth:** `Bearer <token>` required  
**Query param:** `?mode=secure` (default) or `?mode=insecure`

| Mode | Behaviour |
|------|-----------|
| `insecure` | **NO FRICTION (VULNERABLE)** — decodes JWT only. Works even if token was logged out or user was deleted. |
| `secure` | **WITH FRICTION (SECURE)** — checks blacklist and verifies `is_active = true`. |

**Response `200 OK`**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "alice@example.com",
  "role": "student",
  "is_active": true,
  "created_at": "2026-04-24T10:00:00"
}
```

**Errors**

| Status | Detail |
|--------|--------|
| `401` | `Invalid or expired token` |
| `401` | `Token has been revoked` (secure only) |
| `401` | `User not found or inactive` (secure only) |

---

### DELETE /api/auth/me

Hard-deletes the authenticated user's account (removes row from `users` and related rows).

**Auth:** `Bearer <token>` required  
**Query param:** `?mode=secure` (default) or `?mode=insecure`

| Mode | Behaviour |
|------|-----------|
| `insecure` | **NO FRICTION (VULNERABLE)** — permanently deletes account data but **does not revoke the current token** (`jti` is not blacklisted). |
| `secure` | **WITH FRICTION (SECURE)** — permanently deletes account data **and** blacklists the current token immediately. |

**Response `200 OK` — insecure**
```json
{
  "detail": "Account deleted permanently (token not revoked — insecure mode)"
}
```

**Response `200 OK` — secure**
```json
{
  "detail": "Account deleted permanently and token revoked immediately"
}
```

---

## 2. Admin Endpoints

All admin endpoints are protected by secure auth + role check:
- must present valid bearer token
- token must not be blacklisted
- user must be active
- user role must be `admin`

### GET /api/admin/users

List all users.

**Auth:** `Bearer <admin-token>` required

**Response `200 OK`**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "alice@example.com",
    "role": "student",
    "is_active": true,
    "created_at": "2026-04-24T10:00:00"
  }
]
```

### GET /api/admin/users/{user_id}

Get one user by id.

**Auth:** `Bearer <admin-token>` required

### PATCH /api/admin/users/{user_id}

Update a user's role and/or active status.

**Auth:** `Bearer <admin-token>` required

**Request body**
```json
{
  "role": "teacher",
  "is_active": true
}
```

Both fields are optional; include only what you want to change.

### DELETE /api/admin/users/{user_id}

Hard delete a user account and related records.

**Auth:** `Bearer <admin-token>` required

**Response `200 OK`**
```json
{
  "detail": "User deleted successfully"
}
```

---

## 3. Marks Endpoints (Role-based)

### GET /api/marks

Role-based mark listing endpoint.

**Auth:** `Bearer <token>` required (secure auth)

Behavior:
- `student` → returns only marks where `student_id = current_user.id`
- `teacher` → returns all marks from classrooms owned by the teacher
- `admin` → returns all marks

**Response `200 OK`**
```json
[
  {
    "id": "01f9...",
    "student_id": "550e8400-e29b-41d4-a716-446655440000",
    "classroom_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "marks": 95,
    "updated_at": "2026-04-24T10:05:00"
  }
]
```

### PUT /api/marks/update

Teacher edit/upsert endpoint.

**Auth:** `Bearer <token>` required (secure auth)  
**Role:** `teacher` only

**Request body**
```json
{
  "student_id": "550e8400-e29b-41d4-a716-446655440000",
  "classroom_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "marks": 87
}
```

Validation:
- teacher must own classroom
- student must be enrolled in classroom

---

## 4. Marks — Insecure

### PUT /api/insecure/marks/update

> **NO FRICTION (VULNERABLE)**

**Auth:** `Bearer <token>` required (insecure — blacklisted/inactive tokens accepted)

**Vulnerabilities:**
- No role check — students can update their own (or anyone else's) marks.
- No classroom ownership check — any teacher from any classroom can update.
- No student membership check — marks can be written for any user/classroom combination.

**Request body**
```json
{
  "student_id": "550e8400-e29b-41d4-a716-446655440000",
  "classroom_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "marks": 95
}
```

**Response `200 OK`**
```json
{
  "id": "...",
  "student_id": "550e8400-e29b-41d4-a716-446655440000",
  "classroom_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "marks": 95,
  "updated_at": "2026-04-24T10:05:00"
}
```

---

## 5. Marks — Secure

### PUT /api/secure/marks/update

> **WITH FRICTION (SECURE)**

**Auth:** `Bearer <token>` required (secure — blacklist + active check enforced)

**Friction layers:**
1. Role must be `teacher`.
2. Teacher must own the target classroom (`teacher_id = current_user.id`).
3. Student must be enrolled in that classroom (`classroom_students` row must exist).

**Request body**
```json
{
  "student_id": "550e8400-e29b-41d4-a716-446655440000",
  "classroom_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "marks": 95
}
```

**Response `200 OK`**
```json
{
  "id": "...",
  "student_id": "550e8400-e29b-41d4-a716-446655440000",
  "classroom_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "marks": 95,
  "updated_at": "2026-04-24T10:05:00"
}
```

**Errors**

| Status | Detail |
|--------|--------|
| `401` | `Token has been revoked` |
| `403` | `Only teachers can update marks` |
| `403` | `You do not own this classroom` |
| `404` | `Classroom not found` |
| `400` | `Student is not enrolled in this classroom` |

---

## 6. File Upload — Insecure

### GET /api/insecure/upload-url

> **NO FRICTION (VULNERABLE)**

**Auth:** `Bearer <token>` required (insecure)  
**Query param:** `?key=<any-string>`

**Vulnerabilities:**
- User fully controls the S3 key → path traversal, file overwrite.
- Pre-signed URL valid for **7 days**.
- No content-type restriction → any file type.
- No size restriction → DoS via oversized uploads.

**Example request**
```
GET /api/insecure/upload-url?key=../../admin/config.json
Authorization: Bearer <token>
```

**Response `200 OK`**
```json
{
  "upload_url": "https://<r2-endpoint>/bucket/../../admin/config.json?X-Amz-...",
  "key": "../../admin/config.json",
  "expires_in": 604800
}
```

---

### GET /api/insecure/file-url

> **NO FRICTION (VULNERABLE)**

**Auth:** `Bearer <token>` required (insecure)  
**Query param:** `?key=<any-string>`

**Vulnerabilities:**
- No ownership check — any authenticated user can access any object.
- User-controlled key → read arbitrary objects in the bucket.
- URL valid for **7 days**.

**Example request**
```
GET /api/insecure/file-url?key=submissions/other-user-id/secret.pdf
Authorization: Bearer <token>
```

**Response `200 OK`**
```json
{
  "download_url": "https://<r2-endpoint>/bucket/submissions/other-user-id/secret.pdf?X-Amz-...",
  "expires_in": 604800
}
```

---

## 7. File Upload — Secure

### GET /api/secure/upload-url

> **WITH FRICTION (SECURE)**

**Auth:** `Bearer <token>` required (secure)  
**Query param:** `?classroom_id=<uuid>` *(optional)*

**Friction layers:**
1. Server generates the key — user cannot influence the path:  
   `submissions/{user_id}/{uuid}/{timestamp}.pdf`
2. Pre-signed URL expires in **300 seconds** (5 minutes).
3. Content-type locked to `application/pdf`.
4. Upload size capped at **5 MB** via presigned POST conditions.
5. Upload session recorded in `upload_sessions` table for future ownership validation.

**Example request**
```
GET /api/secure/upload-url?classroom_id=6ba7b810-9dad-11d1-80b4-00c04fd430c8
Authorization: Bearer <token>
```

**Response `200 OK`**
```json
{
  "upload_url": "https://<r2-endpoint>/bucket",
  "key": "submissions/550e8400.../a1b2c3d4.../20260424T100500.pdf",
  "session_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "expires_in": 300
}
```

> **Note:** The `upload_url` from this endpoint is a **presigned POST** URL. You must `POST` a multipart form to it (not a `PUT`), including the fields returned by the R2/S3 SDK. Include `Content-Type: application/pdf` and keep the body under 5 MB.

---

### GET /api/secure/file-url

> **WITH FRICTION (SECURE)**

**Auth:** `Bearer <token>` required (secure)  
**Query param:** `?session_id=<uuid>`

**Friction layers:**
1. Resolves key from DB via `session_id` — user cannot specify an arbitrary key.
2. Session expiry is checked — expired sessions return `410 Gone`.
3. Ownership enforced:
   - Requester is the original uploader, **OR**
   - Requester is a `teacher` who owns the classroom linked to the session.
4. Generated URL expires in **300 seconds**.

**Example request**
```
GET /api/secure/file-url?session_id=f47ac10b-58cc-4372-a567-0e02b2c3d479
Authorization: Bearer <token>
```

**Response `200 OK`**
```json
{
  "download_url": "https://<r2-endpoint>/bucket/submissions/...?X-Amz-...",
  "expires_in": 300
}
```

**Errors**

| Status | Detail |
|--------|--------|
| `401` | `Token has been revoked` |
| `404` | `Upload session not found` |
| `410` | `Upload session has expired` |
| `403` | `You do not have access to this file` |

---

## 8. Friction Comparison Table

| Feature | `/insecure/` | `/secure/` |
|---------|-------------|------------|
| **Auth dependency** | Decodes JWT only | Blacklist check + `is_active` check |
| **Logout** | No-op — token lives 7 days | `jti` inserted to `token_blacklist` immediately |
| **Delete account** | Hard delete, token not revoked | Hard delete + token blacklisted |
| **Marks — role** | Any authenticated user | `teacher` only |
| **Marks — ownership** | Not checked | Teacher must own classroom |
| **Marks — enrollment** | Not checked | Student must be in classroom |
| **Upload key** | User-controlled (path traversal) | Server-generated, scoped to `user_id` |
| **Upload expiry** | 7 days (604 800 s) | 300 s (5 minutes) |
| **Upload content-type** | Unrestricted | Locked to `application/pdf` |
| **Upload size** | Unrestricted | Max 5 MB |
| **File access** | Sign any arbitrary key | Ownership + session expiry validated |

---

## 9. JWT Payload Reference

```json
{
  "sub": "<user_id (uuid)>",
  "role": "student | teacher | admin",
  "jti": "<unique token id (uuid)>",
  "exp": 1750000000
}
```

| Claim | Description |
|-------|-------------|
| `sub` | User's UUID (primary key in `users` table) |
| `role` | User's role — enforced by secure endpoints |
| `jti` | JWT ID — inserted into `token_blacklist` on secure logout/delete |
| `exp` | Unix timestamp — token valid for 7 days from issue |

---

## 10. Error Reference

All error responses follow FastAPI's standard shape:

```json
{
  "detail": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request — validation or business logic failure |
| `401` | Unauthenticated — missing, invalid, expired, or revoked token |
| `403` | Forbidden — authenticated but insufficient role or ownership |
| `404` | Resource not found |
| `410` | Gone — resource existed but has expired (upload session) |
| `422` | Unprocessable entity — request body failed Pydantic validation |
| `500` | Internal server error |
