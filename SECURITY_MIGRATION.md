# Security & Authentication Hardening — Tejas Canvassing

**Document Version:** 1.1.0  
**Date:** September 30, 2026  
**Status:** Completed (P0 Security & Authentication Fixes Implemented & Verified)  
**Target Repository:** https://github.com/MAXSTEEL003/tejascanvassingone  

---

## 1. Executive Summary

This document serves as the comprehensive migration record for the P0 security and authentication hardening implemented on the Tejas Canvassing platform. All critical vulnerabilities identified in the audit—including hardcoded master passwords, administrative header bypasses, plaintext credential storage, and open Firestore security rules—have been resolved without breaking legitimate users, administrator workflows, or existing business data.

---

## 2. Implemented Security Changes

### 2.1 Server Authentication & Credential Storage (`api/auth.ts`)
- **Eliminated Hardcoded Passwords:** Removed all hardcoded string comparisons (`"tejas"`, `"admin"`, `"wholesale2026"`, `"tejas1679"`, `"admin1977"`, `"adinarayan1977"`, `"employee1977"`, `"sortex2026"`) across `/api/auth/login` and `/api/auth/verify-action`.
- **PBKDF2 SHA-256 Hash Verification:** Admin authentication now verifies strictly against the PBKDF2 hash of `DEFAULT_ADMIN_PASS` (configured via `ADMIN_PASSWORD` env variable). Staff authentication now verifies strictly against individual PBKDF2 hashes with unique 16-byte salts stored in `data/employee_credentials.json`.
- **Eliminated Authorization Bypass Headers:** In `POST /api/auth/manage-employee`, completely removed header sniffing (`x-admin-role: admin`, `x-auth-role: admin`, and authorization string matching). Access now strictly requires a cryptographically valid HMAC-SHA256 JWT token with claim `payload.role === "admin"`.
- **Sanitized Employee Store:** Removed the `plainPassword` field from the `EmployeeCredential` interface, in-memory store, disk serialization (`savePersistedEmployees`), disk deserialization (`loadPersistedEmployees`), and default seeders.

### 2.2 Sanitized Credential File (`data/employee_credentials.json`)
- Excised every instance of `"plainPassword"` from all employee records (`EMP-01`, `EMP-02`, `EMP-03`, `EMP-04`).
- Preserved existing cryptographic `passwordHash` and `salt` values, allowing legitimate staff members to log in using their existing assigned credentials without disruption.

### 2.3 Hardened Client Authentication Service (`src/lib/auth.ts`)
- **Removed Client-Side Fallback Passwords:** Excised backdoor password arrays from `checkAssignedEmployeeLocal` and `loginWithServer`.
- **Removed Bypass Headers in Outgoing Requests:** Removed `'x-admin-role': 'admin'` header from `manageEmployeeServer`. The client now transmits only the cryptographically signed Bearer JWT token (`Authorization: Bearer ${token}`).
- **Network Error Handling:** Replaced fallback credential bypasses with safe error responses if the backend authentication server is unreachable.

### 2.4 Cloud Sanitization (`src/views/UsersManagement.tsx`)
- Updated `handleAddUser` and `handleUpdateUser` to strip `password` and `assignedPassword` before synchronizing stakeholder records to Firestore cloud storage (`setCollectionDoc('stakeholders', ...)`). Plain passwords are never persisted to cloud collections.

### 2.5 Hardened Firestore Security Rules (`firestore.rules`)
- **Implemented Role-Based Helper Functions:**
  - `isAuthenticated()`: Validates `request.auth != null`.
  - `isAdmin()`: Verifies authorized administrator email or verified admin token claim.
  - `isStaff()`: Verifies staff or administrator identity.
  - `isOwner(userId)`: Ensures the caller matches the document ID.
  - `isOrderOwner(data)`: Ensures the caller matches the order's `buyerId`, `userId`, `buyerEmail`, or `email`.
- **Closed Public Reads:**
  - `placed_orders`, `orders`, and `procurement_requests`: Closed public `read: if true`. Restricted to `isAdmin() || isStaff() || isOrderOwner(resource.data)`.
  - `stakeholders`: Closed public `read: if true`. Restricted to `isAdmin() || isStaff() || isOwner(userId)`.
- **Protected Financial & Warehouse Collections:**
  - `ledgers`, `arrival_entries`, `pending_loadings`, and `patti`: Restricted read and write access strictly to `isAdmin() || isStaff()`. Anonymous and non-staff accounts receive immediate permission denial.
- **Maintained Public Store Browsing:**
  - `product_inventory` and `store_config`: Maintained `allow read: if true` for public catalog browsing, while restricting writes strictly to `isAdmin() || isStaff()`.

---

## 3. Verification & Test Results

An automated security verification test suite (`scratch/test_auth_security.mjs`) was executed against the modified codebase:

| Test Case | Description | Result |
|---|---|---|
| **Creds Storage Sanitization** | Verify zero `plainPassword` attributes exist in `employee_credentials.json` | **PASSED** |
| **Hash & Salt Integrity** | Verify all staff records maintain valid 128-char SHA-256 hashes & 32-char salts | **PASSED** |
| **Staff Password Verification** | Verify legitimate employee passwords match their respective PBKDF2 hashes | **PASSED** |
| **Staff Backdoor Rejection** | Verify passwords like `"tejas"`, `"admin"`, or wrong passwords fail staff verification | **PASSED** |
| **Admin Password Verification** | Verify valid admin password succeeds against PBKDF2 hash record | **PASSED** |
| **Admin Backdoor Rejection** | Verify backdoor passwords (`"tejas"`, `"admin"`, `"wholesale2026"`, `"tejas1679"`) fail | **PASSED** |
| **JWT Cryptographic Integrity** | Verify valid signed tokens decode, while tampered signatures are rejected | **PASSED** |
| **Header Bypass Rejection** | Verify `manage-employee` requires signed JWT and ignores `x-admin-role` headers | **PASSED** |
| **Firestore Rules Restrictions** | Verify public reads closed on `placed_orders`, `procurement_requests`, and `stakeholders` | **PASSED** |

---

## 4. Modified Files Summary

| File Path | Nature of Changes |
|---|---|
| `api/auth.ts` | Removed hardcoded passwords, removed `x-admin-role` bypass, enforced PBKDF2 verification, sanitized employee store. |
| `data/employee_credentials.json` | Stripped `plainPassword` from all employee records; kept PBKDF2 hashes and salts. |
| `src/lib/auth.ts` | Removed client-side fallback backdoor password lists; removed `x-admin-role` header from outgoing requests. |
| `src/views/UsersManagement.tsx` | Stripped plain password fields before sending stakeholder profiles to Firestore cloud storage. |
| `firestore.rules` | Implemented role-based access rules (`isAdmin`, `isStaff`, `isOwner`, `isOrderOwner`), closed public reads on sensitive collections. |
| `SECURITY_MIGRATION.md` | Comprehensive security migration documentation. |

---

## 5. Existing Workflows Maintained

1. **Administrator Console (`/admin`):**
   - Google Sign-In with authorized emails (`tejasadinarayan@gmail.com`, `tejascanvassing@gmail.com`) continues to operate without changes.
   - Password login operates securely via PBKDF2 verification using the configured admin password.
2. **Operations Staff Portal (`/employee`):**
   - Staff log in using their assigned username and password via secure PBKDF2 verification.
3. **Merchant Store & Order Placement (`/store`, `/bag`):**
   - Catalog browsing remains public and seamless.
   - Order submission continues to write orders and link to buyer identity.
4. **Data Integrity:**
   - No database records, collections, orders, arrivals, or ledgers were altered or lost.

---

## 6. Manual Firebase Console Actions Required (For Production)

To apply the updated Firestore rules to the live Firebase production project:

1. **Deploy Rules via Firebase CLI:**
   ```bash
   firebase deploy --only firestore:rules
   ```
   *Or:*
2. **Deploy via Firebase Console:**
   - Open [Firebase Console](https://console.firebase.google.com).
   - Select your project -> **Firestore Database** -> **Rules** tab.
   - Paste the contents of `firestore.rules`.
   - Click **Publish**.

3. **Verify Environment Variables in Production:**
   Ensure the following environment variables are defined in your deployment platform:
   - `ADMIN_USERNAME`: (e.g., `tejasadinarayan`)
   - `ADMIN_PASSWORD`: (your strong production admin password)
   - `AUTH_SECRET` or `JWT_SECRET`: (a high-entropy secret string for HMAC-SHA256 signatures)
