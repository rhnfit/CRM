# Deployment guide — step by step

Use this checklist before you ship to production or when onboarding someone to run the app.

---

## Part A — What you do on your machine (every day)

1. **Pull latest code** from your Git host (`git pull`).

2. **Install dependencies** when `package-lock.json` changes:
   ```powershell
   cd backend
   npm install
   ```
   ```powershell
   cd frontend
   npm install
   ```

3. **Run the full gate** from the **repository root** (not inside `backend` or `frontend`):
   ```powershell
   cd path\to\your\CRM\clone
   npm run verify
   ```
   This runs Prisma validate, lint, TypeScript, and production builds for both apps. Fix anything that fails before you merge or deploy.

4. **Run locally** when developing:
   - Database: PostgreSQL running, with `DATABASE_URL` in `backend/.env` pointing at it.
   - Redis: optional for some features; set `REDIS_URL` in `backend/.env` or use Docker Compose.
   - Backend: `cd backend` → `npx prisma migrate dev` (after schema changes) → `npm run start:dev`
   - Frontend: `cd frontend` → `npm run dev`
   - Browser: `http://localhost:3000` — set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if the API is not the default.

---

## Part B — Connect GitHub (or similar) so CI runs automatically

1. **Create a repository** on GitHub (if you have not already) and push this project:
   ```powershell
   cd path\to\your\CRM\clone
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

2. **CI is already defined** in `.github/workflows/ci.yml`. On every push or pull request to `main` or `master`, GitHub Actions will:
   - run `npm ci` and `npm run verify` in **backend**
   - run `npm ci` and `npm run verify` in **frontend**

3. **Open your repo on GitHub** → tab **Actions** → confirm the workflow is green after a push.

If CI fails, open the failed job log, fix the issue locally, run `npm run verify` again, commit, and push.

---

## Part C — Production environment variables

Copy `backend/.env.example` to your host’s secret store (or server env file) and set **real** values. Nothing in this list should be committed to git.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (SSL often required on managed DBs). |
| `REDIS_URL` | Redis for caching, BullMQ, and related features. |
| `JWT_SECRET` | Long random string for signing access tokens. |
| `REFRESH_TOKEN_SECRET` | Separate long random string for refresh tokens (set in production). |
| `CORS_ORIGIN` | Comma-separated list of **exact** browser origins (e.g. `https://app.yourdomain.com`). |
| `PORT` | API listen port (often set by the platform, e.g. `4000`). |

**Frontend (build-time for Next.js):**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Public URL of the API **without** trailing slash (e.g. `https://api.yourdomain.com`). |

Rebuild the frontend whenever `NEXT_PUBLIC_*` changes.

**Optional integrations** (WhatsApp, SMTP, S3): see comments in `backend/.env.example`.

---

## Part D — Database migrations in production

- **Never** use `prisma migrate dev` on production. Use:
  ```bash
  npx prisma migrate deploy
  ```
  Run this from the `backend` folder with `DATABASE_URL` set, typically as part of your release process or container startup.

- **Seed** is for dev/demo only unless you intentionally run it once in a controlled way:
  ```bash
  npx prisma db seed
  ```

- **Backups:** enable automated backups on your managed PostgreSQL (Neon, RDS, Supabase, etc.) and test restore in a non-production environment at least once.

---

## Part E — A simple hosting pattern (example)

This is one common split; adapt names and URLs to your provider.

1. **Database:** Create a PostgreSQL instance (e.g. Neon, Supabase, RDS). Copy the connection string into `DATABASE_URL` (enable SSL if required).

2. **Redis:** Create Redis (e.g. Upstash, ElastiCache). Set `REDIS_URL`.

3. **API:** Deploy the NestJS `backend` (Dockerfile in `backend/`, or Node on a VPS). Set all backend env vars. Run `npx prisma migrate deploy` on each release before or as the app starts.

4. **Frontend:** Deploy the Next.js `frontend` to Vercel (or similar). Set `NEXT_PUBLIC_API_URL` to your public API URL. Add your Vercel domain to `CORS_ORIGIN` on the backend.

5. **Smoke test:** Log in, open leads, open pipeline, confirm realtime if you use it.

---

## Part F — Operations reminders

- **Secrets:** rotate `JWT_SECRET` / refresh secrets if they leak; require users to log in again.
- **HTTPS:** terminate TLS at your load balancer or platform; do not expose the API over plain HTTP in production.
- **Monitoring:** add uptime checks and error tracking when you are ready (Sentry, Logtail, cloud provider metrics).

For an AWS-oriented architecture, see **AWS deployment sketch** in `README.md`.
