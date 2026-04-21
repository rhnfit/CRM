# Test the CRM on the cloud (realtime + HTTPS)

Use this when you want **HTTPS**, **separate frontend and API URLs**, and **Socket.IO** (dashboard live updates) like production.

## What you need

| Piece | Role |
|--------|------|
| **PostgreSQL** | App data (Neon, Supabase, RDS, or your host’s Postgres) |
| **Redis** | Caching, BullMQ queues (Upstash, Redis Cloud, or host Redis) |
| **Backend (NestJS)** | Long‑running Node process — **not** Vercel serverless for the API |
| **Frontend (Next.js)** | Vercel, Netlify, or static host |

Socket.IO needs a **stable HTTP server** (Railway, Render, Fly.io, ECS, etc.). The browser talks to **`NEXT_PUBLIC_API_URL`** for REST + WebSockets.

## 1. Backend (example: Railway)

1. Create a project and **deploy from GitHub** (this repo).
2. Set **root directory** to `backend` (or use the `backend/Dockerfile`).
3. Add **Postgres** and **Redis** plugins (or external URLs).
4. **Environment variables** (minimum):

   | Variable | Example |
   |----------|---------|
   | `DATABASE_URL` | From your Postgres provider (with `?sslmode=require` if required) |
   | `REDIS_URL` | `rediss://...` (TLS) from Upstash is fine |
   | `JWT_SECRET` | Long random string |
   | `REFRESH_TOKEN_SECRET` | Another long random string |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | **Exact** frontend URL, e.g. `https://your-app.vercel.app` (no trailing slash) |
   | `COOKIE_SAME_SITE` | `none` (required when frontend and API are on **different** domains) |
   | `PORT` | Often set automatically (e.g. `4000` or `$PORT`) |

5. **Release command / one-off** after first deploy (from `backend`):

   ```bash
   npx prisma migrate deploy
   ```

   Optional demo data:

   ```bash
   npx prisma db seed
   ```

6. Note the **public API URL**, e.g. `https://your-api.up.railway.app`.

## 2. Frontend (example: Vercel)

1. **Import** the same GitHub repo.
2. Set **root directory** to `frontend`.
3. **Environment variable**:

   | Variable | Value |
   |----------|--------|
   | `NEXT_PUBLIC_API_URL` | Your backend URL, e.g. `https://your-api.up.railway.app` — **no trailing slash** |

4. Deploy. Open the **Vercel URL** and log in.

## 3. Realtime (Socket.IO)

- The app connects to **`${NEXT_PUBLIC_API_URL}/crm`** with WebSockets.
- Your host must allow **WebSocket** upgrades on the same origin as the API (most PaaS do).
- **Cookies:** with split domains, `COOKIE_SAME_SITE=none` + `NODE_ENV=production` + **HTTPS** lets login cookies reach the API and the socket handshake.

## 4. Quick checks

- Browser: open DevTools → Network → confirm API calls go to your cloud API URL.
- `GET https://<api>/api/health` should respond OK.
- After login, the UI “live” indicator should connect when Socket.IO succeeds.

## 5. Simpler alternative: everything in Docker

From the repo root, on a small VPS or local cloud VM with Docker:

```bash
docker compose up --build -d
docker compose exec backend npx prisma db seed
```

Then use tunneling (e.g. **ngrok**, **Cloudflare Tunnel**) to get HTTPS for a short test. Set `CORS_ORIGIN` and `NEXT_PUBLIC_API_URL` to the tunnel URLs.

---

For a longer production checklist, see [DEPLOYMENT.md](./DEPLOYMENT.md).
