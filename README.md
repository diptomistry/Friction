# FRICTION — System Security Exploration

## Overview

This project explores the concept of **Friction in modern system design**.  
While software engineering often focuses on removing friction for speed, scalability, and simplicity, this project demonstrates that **removing friction blindly can lead to security vulnerabilities and loss of control**.

Instead, we show that **intentional friction is sometimes necessary to maintain system integrity, control, and trust.**

---

## 🔐 1. JWT: Stateless Auth vs JWT + Token Blacklist

### Stateless JWT (Frictionless Approach)
- Uses JWT for authentication without storing session data in the database
- Fully stateless and scalable
- Fast validation and simple architecture

### Problem
- Once issued, JWT remains valid until expiry
- If a user is deleted or banned, their token is still usable
- No immediate way to revoke access

### Friction Added: Token Blacklisting
- Maintain a blacklist table in the database
- When a user is removed, their token is invalidated
- Every request checks against blacklist

### Result
- Enables **instant user revocation**
- Restores **system-level control over authentication**

---

## 📁 2. File Upload: Presigned URL vs Presigned URL + Checksum

### Presigned URL (Frictionless Approach)
- Backend generates a temporary S3/R2 upload URL
- Frontend uploads directly to storage
- Avoids backend file handling microservice
- No exposure of API keys

### Problem
- If the presigned URL is leaked:
  - Anyone can upload or overwrite files
  - No visibility or control from backend
- Critical risk in scheduled or sensitive file uploads

### Friction Added: Checksum Validation
- Generate checksum during upload
- Validate checksum during retrieval
- Detect any tampering or overwrite

### Result
- Ensures **file integrity**
- Prevents silent content modification
- Adds **trust layer to direct uploads**

---

## 🔓 3. Broken Access Control (No Friction)

### Frictionless Approach (Incorrect Design)
- API endpoints allow direct update of sensitive data (e.g., marks)
- No proper role or permission checks

### Problem
- Users can manipulate requests (e.g., using browser dev tools)
- Students can update their own marks via API calls
- Frontend restrictions are bypassed easily

### Friction Added: Role-Based Access Control
- Backend enforces strict permissions
- Only authorized roles (e.g., teachers/admins) can modify data

### Result
- Prevents unauthorized data manipulation
- Ensures **backend is the source of truth for permissions**

---

## 🧠 Key Insight

Across all three systems:

- JWT shows authentication without control
- Presigned URLs show convenience without integrity
- Broken access control shows UI-based security without enforcement

In each case:

> Removing friction improves speed, but removes safety and control.

---

## 🎯 Final Conclusion

Friction is not just a performance tradeoff.

> **Friction is a design mechanism that defines where control, trust, and security exist in a system.**

Without the right friction:

> systems may become faster… but they also become vulnerable.