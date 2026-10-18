"use client";
import Link from "next/link";
import { useState } from "react";
import { PublicShell, PageHead } from "@/components/shell";

const docs = [
  { id: "start", t: "Getting started", body: [
    "1) Open the public demo (/demo) — no account needed — or register for a free workspace.",
    "2) Go to Data Hub → Upload. Supported: CSV, TSV, TXT (delimited), JSON, XLSX. You'll see a preview with inferred column types before anything is saved.",
    "3) On import, MondayBrief computes a deterministic data-quality score and detects issues (duplicates, missing values, mixed date formats, numbers stored as text, inconsistent labels, invalid emails/dates, outlier candidates).",
    "4) In the Cleaning Studio, preview each fix (before/after, affected rows/cells, warnings) and apply individually, by category, or via the AI cleaning plan. Every applied step keeps a revertible snapshot; the original upload remains reachable by reverting the first operation.",
    "5) Save the sequence as a recipe, then continue to Analysis, Dashboards, AI Analyst, Questions and Reports without re-uploading.",
  ]},
  { id: "demo", t: "Demo mode rules", body: [
    "The public demo contains exactly 100 fictional e-commerce rows (header excluded). Row usage is shown as “100 / 100 rows” and enforced on the server: uploads above the limit are rejected with an explanation, never silently truncated.",
    "Demo edits live only in your browser session and are reset with one click. Demo visitors cannot access any real workspace, admin page or billing record.",
    "Expected seeded issues: 3 exact duplicates, 2 invalid dates, 1 invalid email, 5 missing values, mixed date formats (ISO/US/EU), inconsistent category casing, currency-formatted numbers stored as text, stray whitespace, one extreme quantity outlier, and one quantity written as the word “two”.",
  ]},
  { id: "quality", t: "How the quality score works", body: [
    "Score = 100 − (weighted issue cells ÷ total cells × 100). High-severity findings weigh 3×, medium 1.5×, low 0.6×. It is recomputed deterministically from the current rows every time — the same data always yields the same score.",
    "An outlier is a candidate for review, not an error. Invalid dates and type mismatches have no automatic fix by design: the tool will not invent replacements.",
  ]},
  { id: "ai", t: "How the AI analyst answers", body: [
    "Questions are matched to validated analytical plans (totals, group-bys, time-series, period comparisons, margins, correlations, distributions, inactivity). Calculations run on your rows in a deterministic engine; the written answer is generated from the computed result and always shows method, columns, period, assumptions and confidence.",
    "No arbitrary code or SQL is executed, and cell contents are treated as untrusted data (prompt-injection safe). If a question can't be established from the data, the analyst says so and suggests answerable alternatives.",
    "An external LLM key (OPENAI_API_KEY) is optional and never changes the numbers — figures always come from the calculation layer.",
  ]},
  { id: "integrations", t: "Database connections", body: [
    "Workspace owners/admins can add PostgreSQL connections under Integrations. “Test connection” performs a real TCP connect + authentication + schema read and reports latency, visible tables, and a safe error category on failure.",
    "Prefer a least-privilege, read-only database role. Credentials are encrypted at rest (AES-256-GCM) and never returned to the browser. The application's own database password is managed only via server environment variables — never through an admin form.",
    "MySQL, Google Sheets, Shopify etc. are listed as roadmap connectors and are explicitly marked “not configured” until their drivers/OAuth credentials are installed — they are never shown as connected without a passing test.",
  ]},
  { id: "billing", t: "Billing & plans", body: [
    "Plan prices and limits come from the database (Admin → Plans) and drive the Pricing page, quotas and entitlements — enforced server-side on uploads, dashboard counts and AI questions.",
    "This build ships in development billing mode unless Stripe is fully configured (secret key + product/price IDs + webhook secret). In development mode, subscriptions and invoices are recorded locally and clearly labelled; no card is ever charged and no card data is collected.",
    "Cancelling keeps access until the end of the period; invoices remain available and your data stays exportable.",
  ]},
  { id: "admin", t: "Administration", body: [
    "Admins sign in at /admin/login. The bootstrap super-admin is created from the ADMIN_EMAIL / ADMIN_PASSWORD environment variables at first seed (defaults documented in README — change them immediately in production).",
    "The Admin Control Center covers users, workspaces, subscriptions, plans, invoices, support inbox, broadcasts, CMS, feature flags, provider status, system health (real checks), jobs and audit logs. Role changes and user deletion require the super administrator.",
  ]},
  { id: "deploy", t: "Deployment summary", body: [
    "Stack: Next.js (App Router) + PostgreSQL via Drizzle ORM. Setup: configure DATABASE_URL, run `npx drizzle-kit push`, build with `npm run build`, start with `npm run start`. Seed data (plans, settings, admin, 100-row demo dataset) is created automatically and idempotently on first request.",
    "Production checklist highlights: set a strong ADMIN_PASSWORD and ENCRYPTION_KEY, serve behind HTTPS, configure SMTP_* for email, Stripe keys + webhook for live billing, schedule database backups (pg_dump), and run automations via an external worker/cron. Full instructions, known limitations and rollback steps are in the repository README.",
    "cPanel/shared hosting can typically serve the built frontend but usually cannot run the Node server with background workers — use a VPS or managed Node/Postgres platform for production.",
  ]},
];
export default function Docs() {
  const [active, setActive] = useState("start");
  const doc = docs.find((d) => d.id === active)!;
  return (
    <PublicShell>
      <PageHead title="Documentation & help" sub="How MondayBrief AI works, what the numbers mean, and exactly where the current limits are." />
      <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-[230px_1fr] gap-5 pb-10">
        <aside className="card p-2.5 h-fit lg:sticky lg:top-24 flex lg:flex-col gap-1 overflow-x-auto">
          {docs.map((d) => <button key={d.id} onClick={() => setActive(d.id)} className={`text-left px-3 py-2 rounded-lg text-[13.5px] font-semibold whitespace-nowrap ${active === d.id ? "text-white" : "hover:bg-black/5"}`} style={active === d.id ? { background: "var(--brand)" } : {}}>{d.t}</button>)}
        </aside>
        <article className="card p-6">
          <h2 className="text-[20px] font-extrabold mb-3">{doc.t}</h2>
          {doc.body.map((p, i) => <p key={i} className="text-[14px] leading-relaxed mb-3">{p}</p>)}
          <div className="flex gap-2 mt-4 flex-wrap"><Link href="/demo" className="btn btn-primary btn-sm">Try the demo</Link><Link href="/contact" className="btn btn-ghost btn-sm">Ask support</Link><Link href="/status" className="btn btn-ghost btn-sm">Service status</Link></div>
        </article>
      </div>
    </PublicShell>
  );
}
