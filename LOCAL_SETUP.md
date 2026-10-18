# MondayBrief AI — Local Setup Guide

This guide gets MondayBrief AI running on your own machine for development or evaluation.

Stack used locally:

- **Next.js 16** (App Router) for the web app + API routes
- **React 19** + **Tailwind CSS**
- **PostgreSQL** for persistence
- **Drizzle ORM / Drizzle Kit** for schema management

---

## 1) Prerequisites

Install these first:

1. **Node.js 20 LTS or 22 LTS** (recommended: 22)
2. **npm 10+** (comes with recent Node versions)
3. **PostgreSQL 14+** (16 recommended), or **Docker Desktop** if you want the easiest DB setup
4. Optional but useful: `psql` CLI (comes with PostgreSQL), Git

Check your versions:

```bash
node -v
npm -v
psql --version   # optional
docker --version # optional, only if using Docker
```

---

## 2) Get the project and install dependencies

Open a terminal in the project root (the folder containing `package.json`), then run:

```bash
npm install
```

If `npm install` fails because of a stale lock/cache issue, retry once:

```bash
npm cache verify
npm install
```

---

## 3) Start PostgreSQL

You have two good local options.

### Option A — Docker (recommended for local dev)

This repo now includes `docker-compose.yml` with the same default credentials the app expects.

```bash
docker compose up -d postgres
docker compose ps
```

Wait until the container is healthy/running.

> If your Docker version uses the older binary, replace `docker compose` with `docker-compose`.

To stop it later:

```bash
docker compose down
```

To fully wipe the local DB volume (destructive, dev only):

```bash
docker compose down -v
```

### Option B — Native PostgreSQL install

Create the local database expected by the default config:

```bash
createdb app_db
```

Or with SQL:

```sql
CREATE DATABASE app_db;
```

Make sure your local Postgres user can log in with the credentials you plan to put in `.env`. The default project config expects:

- Host: `127.0.0.1`
- Port: `5432`
- Database: `app_db`
- User: `postgres`
- Password: `postgres`

If your local credentials differ, that is fine — just update both `.env` **and** `drizzle.config.json` (see the important note in Step 4).

---

## 4) Create your `.env` file

Copy the example file:

### macOS / Linux

```bash
cp .env.example .env
```

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### Windows CMD

```bat
copy .env.example .env
```

For a first local run, this `.env` is enough:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
ADMIN_EMAIL=admin@mondaybrief.ai
ADMIN_PASSWORD=Admin@12345
ENCRYPTION_KEY=local-dev-encryption-key
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
OPENAI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Important notes

- **`DATABASE_URL` is required.** The app will throw an error at startup if it is missing.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` are used **only when the admin account is first seeded**. If the database was already seeded, changing them later does **not** change the existing admin password.
- `.env.example` uses the placeholder `ADMIN_PASSWORD=change-me-in-production`. If you copy it unchanged before first seeding, that literal placeholder becomes your first admin password.
- `ENCRYPTION_KEY` is strongly recommended even locally. If left empty, the app derives a key from `DATABASE_URL`, which works for local development but is not ideal for real deployment.
- **Custom database note:** `drizzle.config.json` currently contains the default local DB URL directly. If you change `DATABASE_URL` to a different host/database/credentials, also update `drizzle.config.json` → `dbCredentials.url` to the same value before running Drizzle commands.

---

## 5) Create the database schema

With PostgreSQL running and `.env` in place, apply the schema:

```bash
npx drizzle-kit push
```

You should see Drizzle connect and apply changes successfully.

Optional verification with `psql`:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:5432/app_db" -c "\dt"
```

You should see tables such as `users`, `workspaces`, `datasets`, `dataset_rows`, `dashboards`, `invoices`, `audit_logs`, etc.

---

## 6) Run the app

### Development mode (recommended while working locally)

```bash
npm run dev
```

Then open:

- App home: http://localhost:3000
- Public demo: http://localhost:3000/demo
- User login: http://localhost:3000/login
- Admin login: http://localhost:3000/admin/login
- Health check: http://localhost:3000/api/health
- Status page: http://localhost:3000/status

### Production-style local run

```bash
npm run build
npm run start
```

### If port 3000 is already in use

```bash
npx next dev -p 3001
```

or for production build locally:

```bash
PORT=3001 npm run start
```

Windows PowerShell:

```powershell
$env:PORT=3001; npm run start
```

---

## 7) First-run seed data and accounts

The app seeds itself automatically on first request after the schema exists. That means the first page/API hit creates:

- pricing plans
- app settings + CMS content
- feature-provider settings
- the bootstrap super-admin
- a demo user
- a demo workspace with the exact **100-row** sample dataset
- a sample dashboard, subscription, invoice, notification, support thread, and automation

### Seeded accounts

| Role | Email | Password |
|---|---|---|
| Super admin | whatever you set in `ADMIN_EMAIL` before first seed | whatever you set in `ADMIN_PASSWORD` before first seed |
| Demo user | `demo@mondaybrief.ai` | `Demo@12345` |

If you used the `.env` example in Step 4 exactly as shown, your first admin login is:

- **Email:** `admin@mondaybrief.ai`
- **Password:** `Admin@12345`

> Change these before any real deployment.

### Quick verification checklist

After the server starts, verify these work:

1. Open `/demo` — you should see **100 / 100 rows**
2. Open `/login` and sign in as the demo user
3. Open **Data Hub** — the seeded dataset should be listed
4. Open the dataset — Cleaning Studio should load with quality score + detected issues
5. Open `/admin/login` and sign in as admin
6. Open **Admin → System Health** — database checks should pass

API smoke test:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/public?health=1
curl http://localhost:3000/api/demo
```

---

## 8) Optional integrations in local dev

You do **not** need these for the core app to work. MondayBrief is designed to label missing providers honestly instead of pretending they work.

### Email (`SMTP_*`)

If SMTP is not configured:

- password reset uses a dev-token flow shown in the UI
- invites/messages still persist in-app, but no real email is sent

To enable real outbound email later, fill in:

```env
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
EMAIL_FROM=your-from-address
```

Then restart the dev server.

### Payments (`STRIPE_*`)

Without full Stripe configuration, billing runs in **development billing mode**:

- subscriptions/invoices are stored locally
- the UI says clearly that **no real charge occurred**

Do not add only a random `STRIPE_SECRET_KEY` and expect checkout to be live — live billing also needs proper product/price setup and webhook configuration.

### OpenAI (`OPENAI_API_KEY`)

Optional. Even when present, numerical answers still come from the deterministic local analytics engine.

### PostgreSQL integration tester

Inside the app (**Integrations** page), workspace owners/admins can add a PostgreSQL connection and run a real connection test.

A handy local test is the app's own database:

- Host: `127.0.0.1`
- Port: `5432`
- Database: `app_db`
- Username: `postgres`
- Password: `postgres`

For safer testing, create a dedicated **read-only** Postgres role for analytics.

---

## 9) Useful local commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run start        # run production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npx next typegen     # generate Next route types
npx drizzle-kit push # apply schema changes to local DB
```

Recommended full local validation before sharing changes:

```bash
npx next typegen
npm exec tsc -- --noEmit
npm run build
```

---

## 10) Resetting local data

### Reset only the seeded demo dataset

Use the app UI:

**Admin → System Health → Reset demo dataset**

That restores the demo workspace's sample dataset to the pristine 100-row version and clears its cleaning history. Other data is untouched.

### Reset the entire local database (dev only)

#### Docker

```bash
docker compose down -v
docker compose up -d postgres
npx drizzle-kit push
npm run dev
```

#### Native PostgreSQL

```bash
dropdb app_db
createdb app_db
npx drizzle-kit push
npm run dev
```

> Both of these are destructive for your **local** database. Do not do this against a production/staging database.

---

## 11) Backup and restore (local)

Backup:

```bash
pg_dump "postgresql://postgres:postgres@127.0.0.1:5432/app_db" > mondaybrief-backup.sql
```

Restore:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:5432/app_db" < mondaybrief-backup.sql
```

---

## 12) Troubleshooting

### `DATABASE_URL is required`

Cause: `.env` is missing, misnamed, or not in the project root.

Fix:

1. Confirm `.env` exists next to `package.json`
2. Confirm it contains `DATABASE_URL=...`
3. Restart `npm run dev`

### `ECONNREFUSED 127.0.0.1:5432`

Cause: PostgreSQL is not running, Docker Desktop is closed, or the port/host is wrong.

Fix:

- Start PostgreSQL or run `docker compose up -d postgres`
- Confirm nothing else is conflicting on port 5432
- Verify host is `127.0.0.1` for local native installs

### `password authentication failed for user "postgres"`

Cause: credentials in `.env` (and possibly `drizzle.config.json`) do not match your local PostgreSQL user.

Fix:

- Update the password in **both** places
- Or switch to Docker Compose defaults (`postgres` / `postgres`)

### Tables do not exist / `relation "users" does not exist`

Cause: schema was not pushed to the database the app is actually using.

Fix:

```bash
npx drizzle-kit push
```

Then confirm the DB target in `drizzle.config.json` matches `DATABASE_URL`.

### Admin password does not work after editing `.env`

Cause: the admin account was already seeded earlier. `ADMIN_PASSWORD` is only used during first seed.

Fix options:

- sign in with the original password you set at first run, or
- reset the entire local database (Step 10), or
- use the in-app account recovery flow available to an existing admin/support process

### Port 3000 already in use

Run on another port:

```bash
npx next dev -p 3001
```

### Demo shows the correct product but data looks "already edited"

Cause: the seeded demo user's dataset was modified during testing.

Fix:

- Public demo page → **Reset demo**, or
- Admin → **System Health** → **Reset demo dataset**

### `psql` command not found on Windows

That only affects optional CLI verification/backup commands. Either install PostgreSQL tools or use Docker + the app UI.

### Weird build/runtime cache errors

Stop the server, remove the Next build cache, and retry:

```bash
rm -rf .next
npm run dev
```

Windows PowerShell:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

---

## 13) What to try first (5-minute tour)

1. Open `/demo`
2. In the Cleaning Studio, open **Issues**
3. Preview the duplicate-row fix and a date-standardization fix
4. Switch to **Ask AI** and run: **“Which product generated the most revenue?”**
5. Log in as the demo user
6. Open **Data Hub → dataset → Cleaning Studio**
7. Build a dashboard from the dataset
8. Log in as admin and open **System Health**

If those all work, your local environment is ready.
