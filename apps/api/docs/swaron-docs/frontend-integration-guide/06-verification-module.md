# Verification Module — Frontend Integration Guide

> **Base URL:** `http://localhost:3000`
>
> **CORS:** Allowed origins — `localhost:3000` through `localhost:3006`, and `localhost:5173` through `localhost:5176` (Vite dev servers).
>
> **Global Response Format (Success):**
> ```json
> {
>   "success": true,
>   "message": "OK",
>   "data": { ... }
> }
> ```
>
> **Global Response Format (Error):**
> ```json
> {
>   "success": false,
>   "message": "Error description",
>   "error_code": 1500,
>   "data": null
> }
> ```

---

## Overview

The Verification module has **no direct user-facing endpoints**. It is a fully backend-internal system that processes property verification **asynchronously** after a user submits a property for review.

The entire flow is:

```
User submits property              Background (3s delay)           Notification (logged only)
       │                                    │                              │
       ▼                                    ▼                              ▼
┌──────────────────┐    ┌──────────────────────────┐    ┌─────────────────────────┐
│ POST /properties │    │ MockVerificationService   │    │ VerificationListener     │
│ /:id/submit      │───▶│ .verify(propertyId)       │───▶│ .onVerified / .onRejected│
│                  │    │                          │    │                         │
│ → 202 Accepted   │    │ Checks last hex digit     │    │ Logs notification        │
│ → Creates        │    │ of property UUID:         │    │ via INotificationService │
│   Verification   │    │ 0-7 → verified            │    │                          │
│   record (pending)│   │ 8   → rejected (manual)   │    │ (Currently just log —    │
│ → Enqueues       │    │ 9   → rejected (docs)     │    │  no persistence/SSE/push)│
│   background task│    │                          │    │                          │
└──────────────────┘    └──────────────────────────┘    └─────────────────────────┘
         │                                                     │
         │  Also updates property:                             │
         │  • status → "active" (verified)                     │
         │  • status → "active" (rejected — still active)      │
         │  • is_verified → true/false                         │
         ▼                                                     ▼
   Property visible to public                            User sees notification
   (if status=active)                                    (future: SSE/push)
```

---

## 1. Trigger: Submit Property for Verification

> **This is the only user-facing action.** Documented fully in the Property Module guide (endpoint #7).

**`POST /v1/properties/:id/submit`**

| Detail | Value |
|--------|-------|
| Auth | 🔒 JWT (property owner only) |
| Rate limit | 10 requests per 60 seconds |
| HTTP Status | **202 Accepted** (not 200 — the verification runs async) |

### Prerequisites

Before submitting, the property must meet ALL of these requirements:

| Requirement | Condition |
|-------------|-----------|
| Status = `pending` | Property must have `title`, `type`, `listing_type`, and `price` filled |
| Title | Must be non-empty |
| Description | Must be non-empty |
| Type | Must be set (e.g., `residential`, `commercial`) |
| Listing type | Must be set (`sale` or `rent`) |
| Price | Must be > 0 |
| Area | Must belong to a valid area |
| Area size | Must be > 0 |
| Area unit | Must be set (e.g., `sqft`) |
| Address | Must be non-empty |
| Location lat | Must be set |
| Location lng | Must be set |
| Media | At least 1 media item (image or video) |

### Success Response (Background)

Once submitted, the frontend can poll `GET /v1/properties/my` or `GET /v1/properties/:id` to see status changes. However, the endpoint itself immediately returns:

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property",
    "status": "pending"
  }
}
```

---

## 2. Background Processing (Automatic)

After submission, the backend does the following **automatically** — no further API calls needed.

### Step 1: Create Verification Record

A `Verification` record is created in the database:

```json
{
  "id": "uuid-of-verification",
  "property_id": "uuid-of-property",
  "status": "pending",
  "notes": null,
  "verified_at": null,
  "created_at": "2026-07-28T10:00:00.000Z",
  "updated_at": "2026-07-28T10:00:00.000Z"
}
```

### Step 2: Enqueue Background Task

The background task runs after a **3-second delay** (configurable via `VERIFICATION_DELAY_MS` environment variable).

### Step 3: Mock Verification Provider

The current implementation (`MockVerificationService`) simulates an AI/third-party verification service with a **random delay of 2–5 seconds**.

It determines the result based on the **last hexadecimal digit** of the property's UUID:

| Last UUID Digit | Result | Notes |
|-----------------|--------|-------|
| `0` – `7` | ✅ **verified** | — |
| `8` | ❌ **rejected** | `"Manual review required"` |
| `9`, `a`–`f` | ❌ **rejected** | `"Document verification failed"` |

> **Important:** 80% of properties (digits 0–7) will be auto-verified. This is a **mock implementation** — in production, this would call a real verification system.

### Step 4: Update Property Status

After processing, the property and verification records are updated:

| If Verified | If Rejected |
|-------------|-------------|
| `property.status` = `active` | `property.status` = `active` |
| `property.is_verified` = `true` | `property.is_verified` = `false` |
| `property.published_at` = now | `verification.status` = `rejected` |
| `verification.status` = `verified` | `verification.notes` = reason |
| `verification.verified_at` = now | |

> **Note:** Even if rejected, the property remains `active` (published). Only the `is_verified` flag is set to `false`. The property is still visible to the public.

### Step 5: Emit Domain Event

`VerificationService` emits one of two domain events via `@nestjs/event-emitter`:

**Event: `property.verified`**

```json
{
  "propertyId": "uuid-of-property",
  "userId": "uuid-of-owner",
  "verifiedAt": "2026-07-28T10:00:05.000Z"
}
```

**Event: `property.rejected`**

```json
{
  "propertyId": "uuid-of-property",
  "userId": "uuid-of-owner",
  "notes": "Document verification failed"
}
```

### Step 6: Notification (Listener)

`VerificationListener` catches the events and sends a notification via `INotificationService`.

#### Current Behavior (MockNotificationService)

The notification is **only logged to Winston** — no database persistence, no SSE push, no email/SMS:

```
INFO  [MockNotification] User: uuid-of-owner |
      Type: property.verified                |
      Title: Property Verified                |
      Message: Your property has been verified successfully. |
      Metadata: {"propertyId":"...","verifiedAt":"..."}
```

#### Notification Event Payloads

**Verified notification:**
```json
{
  "type": "property.verified",
  "title": "Property Verified",
  "message": "Your property has been verified successfully.",
  "metadata": {
    "propertyId": "uuid-of-property",
    "verifiedAt": "2026-07-28T10:00:05.000Z"
  }
}
```

**Rejected notification:**
```json
{
  "type": "property.rejected",
  "title": "Property Verification Failed",
  "message": "Your property verification was rejected. Reason: Document verification failed",
  "metadata": {
    "propertyId": "uuid-of-property",
    "notes": "Document verification failed"
  }
}
```

---

## 3. Checking Verification Status (Frontend)

Since the verification is **asynchronous**, the frontend needs to check the result. There are two approaches:

### Option A: Poll `GET /v1/properties/:id`

```http
GET http://localhost:3000/v1/properties/uuid-of-property
Authorization: Bearer <token>
```

After verification, the response includes the result:

```json
{
  "success": true,
  "message": "OK",
  "data": {
    "id": "uuid-of-property",
    "status": "active",
    "is_verified": true,
    "published_at": "2026-07-28T10:00:05.000Z",
    ...
  }
}
```

**Key fields to check:**
- `status`: Should be `"active"` after verification (whether verified or rejected)
- `is_verified`: `true` if verified, `false` if rejected
- `published_at`: Set when verification completes (approval or rejection)

### Option B: Poll `GET /v1/properties/my`

List all user properties with their current status.

> **Recommendation:** Poll every 10–15 seconds after submission. The verification typically completes within 5–8 seconds (3s background delay + 2–5s mock verification delay).

---

## 4. Frontend Integration Checklist

| Step | Action | Endpoint |
|------|--------|----------|
| 1 | Create property (draft) | `POST /v1/properties` |
| 2 | Upload at least 1 media item | `POST /v1/properties/:id/media` (multipart) |
| 3 | Fill all required fields via update | `POST /v1/properties` (with `property_id`) |
| 4 | Submit for verification | `POST /v1/properties/:id/submit` → **202 Accepted** |
| 5 | Poll for status change | `GET /v1/properties/:id` |
| 6 | Check `is_verified` flag | In the property detail response |

---

## 5. Verification Flow Example

### Successful Verification

```
Time 0s    → POST /v1/properties/:id/submit → 202 Accepted
              { id: "uuid-fff0", status: "pending" }
Time 0s    → Verification record created → status: "pending"
Time 3s    → Background task starts
Time 3-5s  → MockVerificationService.verify()
              Last digit of "uuid-fff0" = "0" → verified ✅
Time 3-5s  → Property updated:
              status: "active", is_verified: true
Time 3-5s  → Event "property.verified" emitted
Time 3-5s  → Notification logged
```

### Failed Verification

```
Time 0s    → POST /v1/properties/:id/submit → 202 Accepted
              { id: "uuid-fff8", status: "pending" }
Time 0s    → Verification record created → status: "pending"
Time 3s    → Background task starts
Time 3-5s  → MockVerificationService.verify()
              Last digit of "uuid-fff8" = "8" → rejected ❌
              Notes: "Manual review required"
Time 3-5s  → Property updated:
              status: "active", is_verified: false
Time 3-5s  → Event "property.rejected" emitted
Time 3-5s  → Notification logged with reason
```

---

## 6. Database Schema

### Verification Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID (PK) | Auto-generated |
| `property_id` | UUID (unique) | References Property |
| `status` | enum | `pending`, `verified`, `rejected` |
| `notes` | string? | Rejection reason (if rejected) |
| `verified_at` | datetime? | When verification completed |
| `created_at` | datetime | Auto-set |
| `updated_at` | datetime | Auto-set |

### Property Model (relevant fields)

| Field | Type | Description |
|-------|------|-------------|
| `status` | enum | `draft`, `pending`, `active`, `sold`, `archived` |
| `is_verified` | boolean | `true` only if verification passed |
| `published_at` | datetime? | When verification completed (any result) |

---

## 7. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VERIFICATION_DELAY_MS` | `3000` | Delay before background verification starts (ms) |

---

## 8. Current Limitations & Future Plans

| Limitation | Current Behavior | Future Plan |
|------------|------------------|-------------|
| Background task | `setTimeout`-based (not persistent, lost on restart) | Replace with BullMQ / proper job queue |
| Verification provider | Mock (always auto-approves 80%) | Integrate real AI/document verification |
| Notification | Logged to Winston only | Database persistence + SSE push + email |
| Admin review UI | No endpoint to manually verify/reject | Admin panel with manual verification controls |

---

## 9. Common Error Codes Reference

| Code | Message | HTTP Status | When |
|------|---------|-------------|------|
| 1500 | Property not found | 404 | Property UUID doesn't exist |
| 1521 | Only draft properties can be submitted for review | 400 | Property status is not `pending` |
| 1521 | Missing required fields: ... | 400 | Required fields not filled before submission |
| 1003 | Forbidden resource | 403 | Not the property owner |
| 1106 | Access token is invalid or has expired | 401 | Missing/invalid JWT |
