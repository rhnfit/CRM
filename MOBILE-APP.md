# Android app — calls, recording, and admin sync (roadmap)

This document captures a **production-grade** approach for the features you asked for. A full native app is **not** a single commit; it is a separate product track with compliance and store requirements.

## What you asked for

| Capability | Notes |
|------------|--------|
| Dial from the app | Requires **Telecom / ConnectionService** (Android) or deep-links into the system dialer |
| In-app recording | **System call recording** is restricted from Android 10+; many OEMs block it. Typical pattern: **server-side** recording via telephony provider, or **user-initiated** recording where legally allowed |
| Automatic recording of every call | Strong **legal / consent** requirements (India: IT Act, privacy expectations, DND/TRAI context). Product must capture **explicit consent** and retention policy |
| Sync to admin | Upload audio + metadata to **S3** (already scaffolded in backend) + **Call** records in DB + admin review UI |

## Recommended architecture

1. **Backend (this repo)**  
   - Keep **`POST /integrations/calls`** (ingestion) and **pre-signed S3 uploads** as the source of truth.  
   - Add admin APIs: list recordings by agent, date, duration, consent flag (iterative).

2. **Mobile**  
   - **Option A — Native Kotlin**  
     - `ConnectionService` + `InCallService` where policy allows; foreground service for ongoing call UX.  
     - Upload finished audio to S3 via presigned URL from CRM API.  
   - **Option B — Capacitor / React Native**  
     - Thin UI; **native modules** for telephony and file upload (same constraints as A).

3. **Compliance**  
   - Per-jurisdiction **disclosure**, **opt-in**, **pause/delete** requests, and **retention limits**.  
   - Never assume “record everything” is legal without legal review.

## Suggested phases

| Phase | Deliverable |
|-------|-------------|
| 1 | Harden **call ingestion API** + admin list/filter for existing `Call` model |
| 2 | **Kotlin** app: login (cookies or token), click-to-dial (Intent), **manual** attach recording file upload |
| 3 | Partner with **CPaaS** (Twilio / Exotel / MCube) for carrier-side recording if auto-record is mandatory |
| 4 | Play recording in admin UI + **audit** trail |

## Realtime

The web app uses **Socket.IO** to `NEXT_PUBLIC_API_URL/crm`. The mobile app can use the same namespace with JWT in `auth` or cookie handling for WebSockets.

---

For cloud URLs and HTTPS, see [CLOUD-TEST.md](./CLOUD-TEST.md).
