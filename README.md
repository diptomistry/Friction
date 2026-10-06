# FRICTION — System Security Exploration

This project explores **intentional friction** in system design. Removing friction for speed and simplicity can also remove control; the demos show where a little friction restores integrity.

## Stack

- **Backend** (`Backend/`): API and security checks
- **Frontend** (`frontend/`): UI for the demos

## Cases

### 1. JWT: Stateless auth vs JWT + token blacklist

**Frictionless:** Stateless JWT validation only.

**Problem:** Tokens stay valid until expiry even if the user is banned or deleted.

**Friction:** Persist a blacklist and reject revoked tokens on each request so access can be cut immediately.

### 2. File upload: Presigned URL vs presigned URL + checksum

**Frictionless:** Client uploads directly to object storage with a short-lived URL.

**Problem:** A leaked URL can allow unexpected uploads or overwrites with little backend visibility.

**Friction:** Generate and verify a checksum so tampering or silent overwrite is detectable.

### 3. Broken access control

**Frictionless (incorrect):** Sensitive updates rely on the UI to hide actions.

**Problem:** Clients can call the API directly and bypass UI restrictions.

**Friction:** Enforce role-based permissions on the backend so authorization is not left to the frontend.

## Key idea

Friction is not only a performance cost. It is a place to put **control, trust, and security** in the design.

## Local setup

Create your own local users in the database for demos. Do not commit real passwords to the repository.

Follow the backend and frontend package READMEs (or `package.json` / run scripts in each folder) to start the services.
