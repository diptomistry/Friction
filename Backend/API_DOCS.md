# Friction Security Demo — API Documentation

> **Core concept:** Every critical feature ships in two flavours.
> - `/api/insecure/…` → **NO FRICTION (VULNERABLE)** — demonstrates what goes wrong without security controls.
> - `/api/secure/…` → **WITH FRICTION (SECURE)** — demonstrates the hardened version.
> - `/api/auth/…` → shared auth endpoints with a `?mode=` param for logout / delete.

Base URL: `http://localhost:8000`  
Interactive docs: `http://localhost:8000/docs`

## File API Update (Final Architecture)

The file-system endpoints were upgraded to the new architecture.  
Use the routes below (they supersede older `/api/insecure/upload-url` and `/api/secure/upload-url` style routes):

- Insecure:
  - `POST /api/insecure/files/upload-url`
  - `POST /api/insecure/files/confirm`
- Secure:
  - `POST /api/secure/files/upload-request`
  - `POST /api/secure/files/upload-confirm`
- Shared file endpoints:
  - `POST /api/files/schedule`
  - `GET /api/files/{file_id}`
  - `GET /api/files/classroom/{classroom_id}`

Global visibility rule:
- Both insecure and secure downloads enforce schedule (`file_schedules.publish_at` must be reached).

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
3. [Classroom Endpoints](#3-classroom-endpoints)
   - [GET /api/classrooms](#get-apiclassrooms)
   - [GET /api/classrooms/students/all](#get-apiclassroomsstudentsall)
   - [POST /api/classrooms](#post-apiclassrooms)
   - [POST /api/classrooms/{classroom_id}/students](#post-apiclassroomsclassroom_idstudents)
   - [GET /api/classrooms/{classroom_id}/students](#get-apiclassroomsclassroom_idstudents)
4. [Marks Endpoints (Role-based)](#4-marks-endpoints-role-based)
   - [GET /api/marks](#get-apimarks)
   - [PUT /api/marks/update](#put-apimarksupdate)
5. [Marks — Insecure](#5-marks--insecure)
   - [PUT /api/insecure/marks/update](#put-apiinsecuremarksupdate)
6. [Marks — Secure](#6-marks--secure)
   - [PUT /api/secure/marks/update](#put-apisecuremarksupdate)
7. [File Upload — Insecure](#7-file-upload--insecure)
   - [POST /api/insecure/files/upload-url](#post-apiinsecurefilesupload-url)
   - [POST /api/insecure/files/confirm](#post-apiinsecurefilesconfirm)
8. [Shared File Endpoints](#8-shared-file-endpoints)
   - [POST /api/files/schedule](#post-apifilesschedule)
   - [GET /api/files/{file_id}](#get-apifilesfile_id)
   - [GET /api/files/classroom/{classroom_id}](#get-apifilesclassroomclassroom_id)
9. [File Upload — Secure](#9-file-upload--secure)
   - [POST /api/secure/files/upload-request](#post-apisecurefilesupload-request)
   - [POST /api/secure/files/upload-confirm](#post-apisecurefilesupload-confirm)
10. [Friction Comparison Table](#10-friction-comparison-table)
11. [JWT Payload Reference](#11-jwt-payload-reference)
12. [Error Reference](#12-error-reference)

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

## 3. Classroom Endpoints

### GET /api/classrooms

List classrooms by role.

**Auth:** `Bearer <token>` required (secure auth)

Behavior:
- `admin` → all classrooms
- `teacher` → only classrooms where `teacher_id = current_user.id`
- `student` → only classrooms where enrolled in `classroom_students`

### POST /api/classrooms

Teacher creates a classroom.

**Auth:** `Bearer <token>` required (secure auth)  
**Role:** `teacher` only

**Request body**
```json
{
  "name": "Physics - Section A"
}
```

### GET /api/classrooms/students/all

Teacher enrollment helper endpoint.

**Auth:** `Bearer <token>` required (secure auth)  
**Role:** `teacher` only

Returns all active users with role `student`, so frontend can pick and enroll them into a classroom.

### POST /api/classrooms/{classroom_id}/students

Teacher enrolls a student into a classroom.

**Auth:** `Bearer <token>` required (secure auth)  
**Role:** `teacher` only  
**Ownership:** teacher must own the classroom

**Request body**
```json
{
  "student_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### GET /api/classrooms/{classroom_id}/students

List students enrolled in a classroom.

**Auth:** `Bearer <token>` required (secure auth)  
**Role:** `teacher` (owner only) or `admin`

---

## 4. Marks Endpoints (Role-based)

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

## 5. Marks — Insecure

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

## 6. Marks — Secure

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

## 7. File Upload — Insecure

### POST /api/insecure/files/upload-url

> **NO FRICTION (VULNERABLE)**

**Auth:** `Bearer <token>` required (insecure)  
**Body:** `{ "key": "<any-string>" }`

**Vulnerabilities:**
- User fully controls the S3 key → path traversal, file overwrite.
- Pre-signed URL valid for **7 days**.
- No content-type restriction → any file type.
- No size restriction → DoS via oversized uploads.

**Example request**
```
POST /api/insecure/files/upload-url
Authorization: Bearer <token>
Body: {"key":"exams/midterm.pdf"}
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

### POST /api/insecure/files/confirm

Store uploaded file metadata using the user-controlled key.

**Auth:** `Bearer <token>` required (insecure)

**Request body**
```json
{
  "key": "exams/midterm.pdf",
  "classroom_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
}
```

**Response `200 OK`**
```json
{
  "detail": "Upload confirmed",
  "file_id": "<uuid>"
}
```

## 8. Shared File Endpoints

### POST /api/files/schedule

Schedule file visibility (general endpoint).

**Auth:** `Bearer <token>` required (secure auth)  
**Role:** `teacher` (owner classroom) or `admin`

**Request body**
```json
{
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "publish_at": "2026-04-24T15:00:00"
}
```

### GET /api/files/{file_id}

Unified file download endpoint.

**Auth:** `Bearer <token>` required

Behavior:
- Always enforces schedule visibility (`publish_at <= now`)
- if `content_hash` exists:
  - applies secure-style role/access checks
  - verifies checksum integrity before issuing URL
- if `content_hash` is missing:
  - applies insecure-style access (no ownership checks)

### GET /api/files/classroom/{classroom_id}

List classroom files for feed/profile screens.

**Auth:** `Bearer <token>` required (secure auth)

Behavior:
- `admin`: any classroom
- `teacher`: own classroom only
- `student`: only enrolled classroom
- visibility:
  - `teacher` / `admin`: all classroom files (including future scheduled)
  - `student`: only currently visible files (`publish_at <= now`)

Each list item includes:
- `file_id`
- `filename` (derived from final key / temp key basename)
- `status`
- `publish_at`
- `created_at`

---

## 9. File Upload — Secure

### POST /api/secure/files/upload-request

> **WITH FRICTION (SECURE)**

**Auth:** `Bearer <token>` required (secure)  
**Body:**
```json
{
  "classroom_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "filename": "midterm.pdf"
}
```

**Friction layers:**
1. Backend generates `file_id` mapping.
2. Key is deterministic from classroom + filename.
3. Upload URL is valid for 7 days.
4. Confirm step captures object checksum hash (`ETag`).

**Example request**
```
POST /api/secure/files/upload-request
Authorization: Bearer <token>
```

**Response `200 OK`**
```json
{
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "upload_url": "https://<r2-endpoint>/bucket/submissions/<classroom_id>/<filename>.pdf?X-Amz-...",
  "key": "submissions/<classroom_id>/<filename>.pdf",
  "expires_in": 604800
}
```

### POST /api/secure/files/upload-confirm

Confirm upload completion, bind uploaded object to `file_id`, and store checksum hash.

**Request body**
```json
{
  "file_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

## 10. Friction Comparison Table

| Feature | `/insecure/` | `/secure/` |
|---------|-------------|------------|
| **Auth dependency** | Decodes JWT only | Blacklist check + `is_active` check |
| **Logout** | No-op — token lives 7 days | `jti` inserted to `token_blacklist` immediately |
| **Delete account** | Hard delete, token not revoked | Hard delete + token blacklisted |
| **Marks — role** | Any authenticated user | `teacher` only |
| **Marks — ownership** | Not checked | Teacher must own classroom |
| **Marks — enrollment** | Not checked | Student must be in classroom |
| **Upload key** | User-controlled (overwrite risk) | Deterministic `submissions/{classroom_id}/{filename}` |
| **Upload expiry** | 7 days (604 800 s) | 7 days (604 800 s) |
| **Scheduling check** | Enforced globally on download | Enforced globally on download |
| **Integrity check** | None | Checksum (`ETag`) verified on secure download |
| **File access** | Unified `/api/files/{file_id}` with DB-driven policy (`content_hash` missing => insecure behavior) | Unified `/api/files/{file_id}` with DB-driven policy (`content_hash` exists => secure behavior) |

---

## 11. JWT Payload Reference

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

## 12. Error Reference

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
| `410` | Gone — resource existed but has expired (legacy/other flows) |
| `422` | Unprocessable entity — request body failed Pydantic validation |
| `500` | Internal server error |
