# MondayBrief AI — From messy data to meaningful decisions

An AI-assisted data cleaning, analytics, dashboard and business-intelligence SaaS with a complete admin control center. Built on **Next.js 16 (App Router) + PostgreSQL + Drizzle ORM** (the environment's supported stack — the modular service layer in `src/lib` mirrors the FastAPI-style separation: auth, data engine, billing, admin, diagnostics).

## Quick start

For the full step-by-step local machine guide (Node, PostgreSQL/Docker, `.env`, Drizzle, seeded accounts, troubleshooting), see **[LOCAL_SETUP.md](./LOCAL_SETUP.md)**.

```bash
npm install
# .env must contain DATABASE_URL (see .env.example)
npx drizzle-kit push          # create tables
npm run build && npm run start  # or: npm run dev
```

Seed data is created **automatically and idempotently** on first request: 5 plans, app settings/CMS, the bootstrap admin, a demo account, and the exact-100-row demo dataset.

### Seeded accounts (change in production!)
| Role | Email | Password |
|---|---|---|
| Super admin | `ADMIN_EMAIL` (default `admin@mondaybrief.ai`) | `ADMIN_PASSWORD` (default `Admin@12345`) |
| Demo user | `demo@mondaybrief.ai` | `Demo@12345` |

Admin sign-in: `/admin/login`. Public demo: `/demo` (no account needed).

## Architecture

- `src/lib/dataEngine.ts` — deterministic engine: type inference, profiling, issue detection (duplicates, missing, whitespace, label casing, mixed/invalid dates, number-as-text, currency formats, invalid emails, IQR outliers), 17 cleaning operations with before/after diffs, quality score, group-by/time-series/correlation, question generation and **grounded question answering** (an LLM never invents numbers).
- `src/lib/demoData.ts` — deterministic 100-row fictional dataset with documented issues (3 duplicates, 2 invalid dates, 1 invalid email, 5 missing values, mixed date formats, casing variants, `$1,234.50` text numbers, whitespace, an outlier, a word-number).
- `src/lib/auth.ts` — scrypt password hashing, hashed session tokens (httpOnly cookie), AES-256-GCM secret encryption.
- `src/lib/seed.ts` — plans/settings/CMS, admin bootstrap, demo workspace.
- APIs (`src/app/api/`): `auth`, `public`, `demo` (server-enforced 100-row policy), `datasets` + `datasets/[id]` (cleaning w/ snapshots, recipes, analysis), `work` (dashboards, analyst, questions, reports, automations, alerts, integrations w/ **real PostgreSQL connection tests**, notifications, support, billing, team), `admin` (overview, users, subscriptions, plans, invoices, support, CMS, settings, health, jobs, audit).
- Data model: users, sessions, password resets, workspaces, memberships, plans, subscriptions, invoices, files, datasets, **dataset_rows (structured row storage)**, cleaning_ops (with revert snapshots), recipes, dashboards + versions, saved questions, AI usage, reports, automations + runs, alerts, integrations, notifications, conversations/messages, settings, audit logs, jobs, usage events.

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (required) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap super-admin (first seed only) |
| `ENCRYPTION_KEY` | Encrypts integration secrets (falls back to a key derived from `DATABASE_URL` — set explicitly in production) |
| `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM` | Email delivery. **If unset**, the app says so everywhere; password reset shows a dev-only token instead of faking an email |
| `STRIPE_SECRET_KEY`, price IDs, `STRIPE_WEBHOOK_SECRET` | Live billing. **Until fully configured**, billing runs in clearly labelled development mode (local records, zero charges). If only a secret key is present, checkout refuses rather than faking payment |
| `OPENAI_API_KEY` | Optional. Never changes numbers — answers always come from the deterministic engine |

## Database operations

```bash
npx drizzle-kit push                                   # apply schema
psql "$DATABASE_URL" -c "\dt"                          # inspect
pg_dump "$DATABASE_URL" > backup.sql                   # backup
psql "$DATABASE_URL" < backup.sql                      # restore
```
Demo dataset reset: Admin → System Health → "Reset demo dataset" (super-admin; touches only the demo workspace).

## Known limitations (honest list)

1. **Billing**: development mode until Stripe products/prices/webhook are configured; webhook signature verification must be added with the live integration.
2. **Email**: no provider wired in this runtime; verification/invite/reset flows work but do not send mail until `SMTP_*` is set.
3. **Scheduling**: automation schedules are persisted; timed execution needs an external worker/cron invoking runs (e.g. a small cron hitting an authenticated run endpoint). "Run now" executes synchronously with full logs.
4. **Connectors**: PostgreSQL + REST reachability have live testers; MySQL needs `mysql2`, Google Sheets/Shopify need OAuth credentials — all report their real status, never fake "connected".
5. **Scale**: synchronous processing is optimized for the plan row caps (standard target 10,000 rows); larger files are rejected with an explanation, not truncated. Move to background workers/object storage for very large datasets.
6. **MFA/OAuth login/SSO**: not implemented yet (roadmap, admin-first).
7. **Uploads** are parsed in-browser (PapaParse/SheetJS) then validated and stored server-side; this keeps the app deployable anywhere Node runs. cPanel/shared hosting generally cannot run the Node server + workers — use a VPS or managed Node/Postgres host.

## Testing performed

- TypeScript: `npm exec tsc -- --noEmit` · Next type generation: `npx next typegen` · Production build: `npm run build` (see CI/validation output).
- Live checks: database push + seed, demo row-limit rejection, cleaning apply/revert, dashboard save/versioning, grounded answers, admin role gating, real PG connection-test path, support/invoice persistence — verified against the running app during the build.
- Security review: server-side authorization on every protected route, workspace isolation, CSV formula-injection escaping, upload validation + row caps, password/session hashing, no secrets in client code, audit logging of sensitive actions.

## Deployment checklist

1. Provision PostgreSQL; set all env vars (strong `ADMIN_PASSWORD`, `ENCRYPTION_KEY`).
2. `npx drizzle-kit push`, `npm run build`, run behind a reverse proxy with HTTPS (e.g. Caddy/nginx) or a managed Node platform.
3. Configure SMTP and (optionally) Stripe incl. webhook endpoint + price IDs; verify in Admin → System Health.
4. Schedule `pg_dump` backups and test a restore. Point a cron/worker at automation runs if timed workflows are needed.
5. Sign in as admin, review Plans/Settings/CMS, then open registration.
