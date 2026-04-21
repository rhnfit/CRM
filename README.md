# RHN CRM — Right Human Nutrition

Internal CRM for sales and support. Role-based, hierarchy-aware, realtime.

## Tech

- Backend: NestJS 10 + Prisma + PostgreSQL + Redis + Socket.IO
- Frontend: Next.js 14 (App Router) + Tailwind CSS
- Realtime: Socket.IO namespace `/crm`, JWT-authenticated
- Security: Helmet, CORS, Throttler, WhatsApp signed webhook
- Background: `@nestjs/schedule` cron workers (SLA breach + stale-lead nudge)

## Structure

```text
CRM/
  backend/                     NestJS API
    prisma/
      schema.prisma            DB model
      seed.ts                  Demo data (director, agent, support, leads, ticket, sale)
    src/
      auth/                    JWT login/register, /users/me, /users/assignable
      common/                  Decorators + guards (roles, current user)
      users/                   Hierarchy-aware access
      admin/                   Director/Manager/Heads-only: users, teams, stats, audit
      leads/                   CRUD + round-robin assign + detail
      tickets/                 CRUD + detail
      activities/              Timeline + notes
      sales/                   Revenue records
      targets/                 Monthly targets
      incentives/              Compute monthly incentive from sales
      reports/                 Dashboard overview
      teams/                   Read-only CRM team roster
      integrations/            WhatsApp webhook (Meta) + call ingestion
      assignment/              Redis round-robin
      crm/                     Socket.IO gateway
      workers/                 SLA + stale-lead cron
      prisma/, redis/
  frontend/                    Next.js app
    app/
      page.tsx, dashboard/, leads/, leads/[id]/, tickets/, tickets/[id]/,
      sales/, targets/, reports/, login/,
      admin/ (layout, overview, users, teams, audit)
    components/                Nav, LiveIndicator
    lib/                       api, socket
  docker-compose.yml           Postgres + Redis + backend + frontend
```

## Local run (Docker one-shot)

1. Make sure Docker Desktop is running.
2. From the project root:
   ```powershell
   docker compose up --build
   ```
3. First time: seed the DB inside the backend container:
   ```powershell
   docker compose exec backend npx prisma db seed
   ```
4. Open:
   - API: http://localhost:4000/api
   - App: http://localhost:3000
   - Login: http://localhost:3000/login — use [Demo login](#demo-login-after-seed) below.

## Local run (no Docker)

Backend:
```powershell
cd backend
copy .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

Frontend:
```powershell
cd frontend
npm install
# Optional: point the app at your API (defaults to http://localhost:4000 if unset)
# echo NEXT_PUBLIC_API_URL=http://localhost:4000 > .env.local
npm run dev
```

API listens on **http://localhost:4000**; the app on **http://localhost:3000**. Sign in at **http://localhost:3000/login** using the [demo accounts](#demo-login-after-seed).

## Key API routes (prefix `/api`)

- Auth: `POST /auth/register`, `POST /auth/login`
- Me: `GET /users/me`, `GET /users/assignable`
- Admin: `GET /admin/stats`, `GET|POST /admin/users`, `PATCH /admin/users/:id`, `GET|POST /admin/teams`, `PATCH /admin/teams/:id`, `GET /admin/audit`
- Leads: `GET|POST /leads`, `GET|PATCH /leads/:id` (create supports `autoAssignTeamId`)
- Pipeline (Kanban): `GET /pipelines`, `GET /pipelines/:id/board`, `PATCH /leads/:id/move` (`{ "stageId": "..." }`)
- Tickets: `GET|POST /tickets`, `GET|PATCH /tickets/:id`
- Activities: `GET /activities/reference/:id`, `POST /activities/reference/:id/notes`
- Sales: `GET|POST /sales`
- Targets: `GET|POST /targets`
- Incentives: `GET /incentives`, `POST /incentives/compute` (`{ "month": "2026-04" }`)
- Reports: `GET /reports/overview`
- Teams (CRM): `GET /teams`
- Integrations: `GET|POST /integrations/whatsapp/webhook`, `POST /integrations/calls`

## Access model

- `DIRECTOR` — all data, all admin.
- `MANAGER` — own department only.
- `SALES_HEAD`, `SUPPORT_HEAD` — that department.
- `TEAM_LEADER` — own team.
- `AGENT` — self only.

All read queries filter by `assignedTo IN accessibleUserIds`. Admin mutation APIs also enforce department scope and never allow a non-Director to grant `DIRECTOR`.

## Realtime

- Socket.IO: `NEXT_PUBLIC_API_URL/crm` with `{ auth: { token } }`.
- Events: `crm` = `{ resource: 'lead'|'ticket', action: 'created'|'updated'|'sla_breach'|'stale_nudge', id }`.
- The dashboard refreshes live when events arrive.

## Background workers

- Every minute: flag overdue `slaDeadline` tickets and broadcast `sla_breach`.
- Every 15 minutes: nudge leads inactive for `STALE_LEAD_HOURS` (default 24h).

For HA, migrate these to BullMQ workers backed by Redis.

## Performance & search

- **Database:** PostgreSQL is used as the primary OLTP store (strong consistency, excellent for CRM workloads). “Fastest” at scale means **correct indexes**, **connection pooling** (e.g. PgBouncer in front of RDS), and **read replicas** for heavy reporting—not swapping Postgres for a general-purpose key-value DB for relational data.
- **Indexes:** Composite B-tree indexes match the usual list queries (`assignedTo` + `isDeleted` + filters + `createdAt DESC`). Apply migrations with `npx prisma migrate deploy` (or `migrate dev` locally). Migration `20260421120000_perf_list_and_trgm` adds these plus **pg_trgm** GIN indexes for fuzzy search on name/phone/text fields.
- **Search:** `ILIKE '%term%'` on large tables benefits from **pg_trgm** (enabled in that migration). For very large scale or typo-tolerant search, consider **Meilisearch** or **OpenSearch** as a dedicated search service fed by events.
- **Caching:** Redis already caches **accessible user IDs** per actor (`UsersService`). Add similar short-TTL caches only where profiling shows benefit (e.g. dashboard aggregates).
- **API:** Lead/ticket **list** endpoints use a **lean `select`** to return fewer columns and less JSON over the wire.

## Security notes

- JWT for HTTP + WS handshake.
- `helmet` + CORS whitelist (`CORS_ORIGIN`).
- Global throttler: 300 req/min/IP.
- WhatsApp webhook verifies `X-Hub-Signature-256` when `WHATSAPP_APP_SECRET` is set.
- Secrets come from env. In AWS use Secrets Manager / SSM Parameter Store.

## AWS deployment sketch

1. RDS Postgres (private subnet).
2. ElastiCache Redis (private subnet).
3. ECR images for `backend` and `frontend`.
4. ECS Fargate service per image, behind an ALB.
5. `backend` runs `prisma migrate deploy` on start (already in Dockerfile).
6. Set envs: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`.
7. S3 bucket for call recordings; use pre-signed uploads from backend (future).
8. Route 53 + ACM for HTTPS domains.

## Demo login (after seed)

Run `npx prisma db seed` (from `backend/`, or via Docker as above) so these users exist.

| Role | Email | Password |
|------|-------|----------|
| Director | `director@rhn.local` | `ChangeMe123!` |
| Sales agent | `agent@rhn.local` | `AgentPass123!` |
| Support agent | `support@rhn.local` | `SupportPass123!` |

**Director account:** You can set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env` **before** `npx prisma db seed`. The seed uses them for the director user (defaults are the email/password in the first row above). Agent and support passwords are fixed in `prisma/seed.ts` unless you change the seed script.

**Frontend:** Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` to your API base (e.g. `http://localhost:4000`) so the browser can reach the backend; `backend/.env` should list the same origins in `CORS_ORIGIN` for your dev ports.

## CI & deployment

- **Local / pre-merge gate:** from the repo root, run `npm run verify` (Prisma validate, lint, typecheck, and production builds for backend and frontend).
- **GitHub Actions:** pushes and PRs to `main` / `master` run `.github/workflows/ci.yml` (same checks on clean Linux runners).
- **Step-by-step production checklist:** see [DEPLOYMENT.md](./DEPLOYMENT.md) (env vars, migrations, hosting pattern, backups).
- **Cloud smoke test (Vercel + API host, realtime):** see [CLOUD-TEST.md](./CLOUD-TEST.md).

## Status

Production-shape foundation. Next upgrades: S3 call recordings, BullMQ workers, email/SMS notifications, targets rollup screen, dashboard charts.
