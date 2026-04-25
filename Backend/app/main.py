"""
Friction Security Demo — FastAPI entry point.

Every feature exposes two endpoint namespaces:
  /api/insecure/...  →  NO FRICTION (VULNERABLE)
  /api/secure/...    →  WITH FRICTION (SECURE)

The auth router lives at /api/auth/... and supports a ?mode= query param
for logout and delete to demonstrate both behaviours.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin
from app.routers import auth
from app.routers import classrooms
from app.routers import files
from app.routers import marks
from app.routers.insecure import files as insecure_files
from app.routers.insecure import marks as insecure_marks
from app.routers.secure import files as secure_files
from app.routers.secure import marks as secure_marks

app = FastAPI(
    title="Friction Security Demo API",
    description=(
        "Demonstrates security vulnerabilities that arise when friction is removed. "
        "Every critical feature has an /insecure and a /secure variant."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://friction-ashy.vercel.app",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(classrooms.router)
app.include_router(files.router)
app.include_router(marks.router)
app.include_router(insecure_marks.router)
app.include_router(insecure_files.router)
app.include_router(secure_marks.router)
app.include_router(secure_files.router)


@app.get("/", tags=["health"])
async def root():
    return {
        "service": "Friction Security Demo API",
        "docs": "/docs",
        "insecure_prefix": "/api/insecure",
        "secure_prefix": "/api/secure",
        "auth_prefix": "/api/auth",
    }


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
