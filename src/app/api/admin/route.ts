import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import * as S from "@/db/schema";
import { currentUser, publicUser } from "@/lib/auth";
import { ok, fail, ready, audit, notify, invoiceNumber, getSetting } from "@/lib/server";

async function admin() { const u = await currentUser(); if (!u || !["admin", "super_admin", "support"].includes(u.role)) return null; return u; }
const fullAdmin = (u: any) => ["admin", "super_admin"].includes(u.role);

export async function GET(req: Request) {
  await ready();
  const u = await admin(); if (!u) return fail("Administrator access required.", 403);
  const url = new URL(req.url); const resource = url.searchParams.get("resource") || "overview";

  if (resource === "overview") {
    const allUsers = await db.select().from(S.users);
    const allSubs = await db.select().from(S.subscriptions);
    const allInv = await db.select().from(S.invoices);
    const allDs = await db.select().from(S.datasets);
    const allJobs = await db.select().from(S.jobs).orderBy(desc(S.jobs.createdAt)).limit(10);
    const allAi = await db.select().from(S.aiUsage);
    const monthStart = new Date(); monthStart.setDate(1);
    const paidThisMonth = allInv.filter((i) => i.status === "paid" && new Date(i.issuedAt) >= monthStart);
    const mrr = allSubs.filter((s) => s.status === "active").reduce((sum, s) => sum, 0);
    const plansList = await db.select().from(S.plans);
    const mrrCalc = allSubs.filter((s) => s.status === "active").reduce((sum, s) => { const p = plansList.find((x) => x.id === s.planId); return sum + (s.billingCycle === "yearly" ? (p?.priceYearly || 0) / 12 : (p?.priceMonthly || 0)); }, 0);
    const recentAudit = await db.select().from(S.auditLogs).orderBy(desc(S.auditLogs.createdAt)).limit(12);
    const openTickets = await db.select().from(S.conversations).where(eq(S.conversations.status, "Open"));
    return ok({
      stats: {
        users: allUsers.length, activeUsers: allUsers.filter((x) => x.status === "active").length,
        newThisMonth: allUsers.filter((x) => new Date(x.createdAt) >= monthStart).length,
        activeSubs: allSubs.filter((s) => s.status === "active").length,
        mrrCents: Math.round(mrrCalc), mrrDefinition: "Sum over active subscriptions of plan price (yearly ÷ 12). Development-billing records only until a live provider is connected.",
        revenueThisMonthCents: paidThisMonth.reduce((s, i) => s + i.amount, 0),
        datasets: allDs.length, rowsStored: allDs.reduce((s, d) => s + (d.rowCount || 0), 0),
        aiQuestions: allAi.length, openTickets: openTickets.length,
        failedJobs: allJobs.filter((j) => j.status === "failed").length,
      },
      subByPlan: plansList.map((p) => ({ label: p.name, value: allSubs.filter((s) => s.planId === p.id && s.status === "active").length })),
      registrations: (() => { const m = new Map<string, number>(); allUsers.forEach((x) => { const d = new Date(x.createdAt); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].sort().map(([label, value]) => ({ label, value })); })(),
      recentAudit, recentJobs: allJobs, recentUsers: allUsers.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6).map(publicUser),
    });
  }
  if (resource === "users") {
    const list = await db.select().from(S.users).orderBy(desc(S.users.createdAt));
    const subs = await db.select().from(S.subscriptions);
    const ms = await db.select().from(S.memberships);
    return ok({ users: list.map((x) => ({ ...publicUser(x), isSeed: x.isSeed, subscriptions: subs.filter((s) => s.userId === x.id).length, workspaces: ms.filter((m) => m.userId === x.id).length })) });
  }
  if (resource === "workspaces") {
    const ws = await db.select().from(S.workspaces).orderBy(desc(S.workspaces.createdAt));
    const ms = await db.select().from(S.memberships); const ds = await db.select().from(S.datasets);
    const allUsers = await db.select().from(S.users);
    return ok({ workspaces: ws.map((w) => ({ ...w, ownerEmail: allUsers.find((x) => x.id === w.ownerId)?.email || "", members: ms.filter((m) => m.workspaceId === w.id).length, datasets: ds.filter((d) => d.workspaceId === w.id).length })) });
  }
  if (resource === "subscriptions") {
    const subs = await db.select().from(S.subscriptions).orderBy(desc(S.subscriptions.createdAt));
    const allUsers = await db.select().from(S.users);
    return ok({ subscriptions: subs.map((s) => ({ ...s, userEmail: allUsers.find((x) => x.id === s.userId)?.email || "" })) });
  }
  if (resource === "plans") return ok({ plans: await db.select().from(S.plans).orderBy(asc(S.plans.sort)) });
  if (resource === "invoices") {
    const invs = await db.select().from(S.invoices).orderBy(desc(S.invoices.issuedAt));
    const allUsers = await db.select().from(S.users);
    return ok({ invoices: invs.map((i) => ({ ...i, userEmail: allUsers.find((x) => x.id === i.userId)?.email || "", userName: allUsers.find((x) => x.id === i.userId)?.name || "" })) });
  }
  if (resource === "support") {
    const convs = await db.select().from(S.conversations).orderBy(desc(S.conversations.updatedAt));
    const allUsers = await db.select().from(S.users);
    const out = [];
    for (const c of convs) { const msgs = await db.select().from(S.messages).where(eq(S.messages.conversationId, c.id)).orderBy(asc(S.messages.createdAt)); out.push({ ...c, user: (() => { const x = allUsers.find((y) => y.id === c.userId); return x ? { name: x.name, email: x.email } : null; })(), messages: msgs }); }
    return ok({ conversations: out });
  }
  if (resource === "settings") {
    if (!fullAdmin(u)) return fail("Full administrator access required.", 403);
    const rows = await db.select().from(S.settings);
    const out: any = {}; rows.forEach((r) => (out[r.key] = r.value));
    return ok({ settings: out });
  }
  if (resource === "audit") return ok({ audit: await db.select().from(S.auditLogs).orderBy(desc(S.auditLogs.createdAt)).limit(150) });
  if (resource === "jobs") return ok({ jobs: await db.select().from(S.jobs).orderBy(desc(S.jobs.createdAt)).limit(100), runs: await db.select().from(S.automationRuns).orderBy(desc(S.automationRuns.startedAt)).limit(30) });
  if (resource === "health") {
    const checks: any[] = [];
    const run = async (name: string, fn: () => Promise<{ detail: string; ms?: number }>) => { const t = Date.now(); try { const r = await fn(); checks.push({ name, status: "pass", detail: r.detail, ms: r.ms ?? Date.now() - t }); } catch (e: any) { checks.push({ name, status: "fail", detail: String(e.message).slice(0, 200), ms: Date.now() - t }); } };
    await run("Database connectivity (SELECT plans)", async () => { const r = await db.select().from(S.plans); return { detail: `Connected. ${r.length} plan rows readable.` }; });
    await run("Schema tables present", async () => { await db.select().from(S.users).limit(1); await db.select().from(S.datasets).limit(1); await db.select().from(S.invoices).limit(1); return { detail: "Core tables (users, datasets, invoices) respond to queries." }; });
    await run("Dataset row storage", async () => { const r = await db.select().from(S.datasetRows).limit(1); return { detail: `dataset_rows readable (${r.length} sample row).` }; });
    checks.push({ name: "Email provider configuration", status: process.env.SMTP_HOST ? "pass" : "warn", detail: process.env.SMTP_HOST ? `SMTP host configured (${process.env.SMTP_HOST}).` : "SMTP_HOST not set — password-reset and invite emails cannot be sent. The app labels this honestly instead of faking sends.", ms: 0 });
    checks.push({ name: "Payment provider configuration", status: process.env.STRIPE_SECRET_KEY ? "warn" : "warn", detail: process.env.STRIPE_SECRET_KEY ? "STRIPE_SECRET_KEY present, but Stripe Products/Prices + webhook secret still required before live checkout (see README)." : "No Stripe key — development billing mode (subscriptions/invoices recorded locally, zero real charges).", ms: 0 });
    checks.push({ name: "AI provider", status: "pass", detail: process.env.OPENAI_API_KEY ? "External LLM key present. Numerical answers still come from the deterministic analytics layer." : "Built-in deterministic analytics engine active (no external key required, no data leaves the server).", ms: 0 });
    checks.push({ name: "Application database URL", status: process.env.DATABASE_URL ? "pass" : "fail", detail: process.env.DATABASE_URL ? "DATABASE_URL configured via environment (value never exposed in the UI)." : "DATABASE_URL missing.", ms: 0 });
    checks.push({ name: "Encryption key", status: process.env.ENCRYPTION_KEY ? "pass" : "warn", detail: process.env.ENCRYPTION_KEY ? "ENCRYPTION_KEY set for integration secrets." : "ENCRYPTION_KEY not set — a key is derived from DATABASE_URL. Set ENCRYPTION_KEY in production.", ms: 0 });
    checks.push({ name: "Background scheduling", status: "warn", detail: "Schedules are persisted; timed execution requires an external worker/cron hitting automation runs (see README). “Run now” executes synchronously and is fully logged.", ms: 0 });
    const providers = await getSetting("providers", {});
    return ok({ checks, version: "MondayBrief AI 1.0 (Next.js 16 + PostgreSQL)", checkedAt: new Date().toISOString(), providers });
  }
  return fail("Unknown admin resource.");
}

export async function POST(req: Request) {
  await ready();
  const u = await admin(); if (!u) return fail("Administrator access required.", 403);
  const body = await req.json().catch(() => ({}));
  const resource = String(body.resource || ""); const action = String(body.action || "");

  if (resource === "users") {
    if (!fullAdmin(u) && action !== "note") return fail("Full administrator access required.", 403);
    const id = String(body.id);
    const [target] = await db.select().from(S.users).where(eq(S.users.id, id)).limit(1);
    if (!target) return fail("User not found.");
    if (action === "suspend" || action === "activate") {
      if (target.id === u.id) return fail("You cannot suspend your own account.");
      await db.update(S.users).set({ status: action === "suspend" ? "suspended" : "active", updatedAt: new Date() }).where(eq(S.users.id, id));
      if (action === "suspend") await db.update(S.sessions).set({ revokedAt: new Date() }).where(eq(S.sessions.userId, id));
      await audit(u, `admin.user_${action}`, "user", id);
      return ok({});
    }
    if (action === "role") {
      if (u.role !== "super_admin") return fail("Only the super administrator can change roles.", 403);
      if (!["user", "support", "admin"].includes(body.role)) return fail("Invalid role.");
      await db.update(S.users).set({ role: body.role, updatedAt: new Date() }).where(eq(S.users.id, id));
      await audit(u, "admin.user_role", "user", id, { role: body.role });
      return ok({});
    }
    if (action === "revokeSessions") { await db.update(S.sessions).set({ revokedAt: new Date() }).where(eq(S.sessions.userId, id)); await audit(u, "admin.user_sessions_revoked", "user", id); return ok({}); }
    if (action === "message") {
      const [c] = await db.insert(S.conversations).values({ userId: id, subject: String(body.subject || "Message from MondayBrief support").slice(0, 160), topic: "Admin message", status: "Waiting for User" }).returning();
      await db.insert(S.messages).values({ conversationId: c.id, senderId: u.id, senderName: `${u.name} (Support)`, senderRole: "admin", body: String(body.message || "").slice(0, 5000) });
      await notify(id, "support", "New message from support", String(body.subject || ""), "/app/support");
      return ok({});
    }
    if (action === "delete") {
      if (u.role !== "super_admin") return fail("Only the super administrator can delete users.", 403);
      if (target.role === "super_admin") return fail("The super administrator cannot be deleted.");
      const owned = await db.select().from(S.workspaces).where(eq(S.workspaces.ownerId, id));
      for (const w of owned) await db.delete(S.workspaces).where(eq(S.workspaces.id, w.id));
      await db.delete(S.users).where(eq(S.users.id, id));
      await audit(u, "admin.user_delete", "user", id);
      return ok({});
    }
  }

  if (resource === "plans") {
    if (!fullAdmin(u)) return fail("Full administrator access required.", 403);
    const p = body.plan || {};
    await db.update(S.plans).set({ name: p.name, tagline: p.tagline, priceMonthly: Number(p.priceMonthly), priceYearly: Number(p.priceYearly), limits: p.limits, features: p.features, isActive: !!p.isActive, updatedAt: new Date() }).where(eq(S.plans.id, String(body.id)));
    await audit(u, "admin.plan_update", "plan", String(body.id), { priceMonthly: p.priceMonthly });
    return ok({});
  }

  if (resource === "subscriptions") {
    if (!fullAdmin(u)) return fail("Full administrator access required.", 403);
    const [s] = await db.select().from(S.subscriptions).where(eq(S.subscriptions.id, String(body.id))).limit(1);
    if (!s) return fail("Subscription not found.");
    if (action === "cancel") { await db.update(S.subscriptions).set({ status: "canceled", updatedAt: new Date() }).where(eq(S.subscriptions.id, s.id)); if (s.workspaceId) await db.update(S.workspaces).set({ planId: "free" }).where(eq(S.workspaces.id, s.workspaceId)); await audit(u, "admin.subscription_cancel", "subscription", s.id); await notify(s.userId, "billing", "Subscription canceled by administrator", "The workspace now runs on the Free plan. Your data remains exportable.", "/app/billing"); return ok({}); }
    if (action === "changePlan") {
      const [plan] = await db.select().from(S.plans).where(eq(S.plans.id, String(body.planId))).limit(1); if (!plan) return fail("Plan not found.");
      await db.update(S.subscriptions).set({ planId: plan.id, status: "active", updatedAt: new Date() }).where(eq(S.subscriptions.id, s.id));
      if (s.workspaceId) await db.update(S.workspaces).set({ planId: plan.id }).where(eq(S.workspaces.id, s.workspaceId));
      if (plan.priceMonthly > 0) await db.insert(S.invoices).values({ number: invoiceNumber(), userId: s.userId, workspaceId: s.workspaceId, subscriptionId: s.id, amount: plan.priceMonthly, status: "paid", provider: s.provider, lines: [{ description: `Plan changed to ${plan.name} by administrator (${s.provider} billing)`, amount: plan.priceMonthly }], paidAt: new Date() });
      await audit(u, "admin.subscription_change_plan", "subscription", s.id, { plan: plan.id });
      return ok({});
    }
  }

  if (resource === "invoices") {
    if (!fullAdmin(u)) return fail("Full administrator access required.", 403);
    if (action === "status") { await db.update(S.invoices).set({ status: String(body.status), paidAt: body.status === "paid" ? new Date() : null }).where(eq(S.invoices.id, String(body.id))); await audit(u, "admin.invoice_status", "invoice", String(body.id), { status: body.status }); return ok({}); }
    if (action === "create") {
      const [inv] = await db.insert(S.invoices).values({ number: invoiceNumber(), userId: String(body.userId), amount: Number(body.amountCents || 0), status: "open", provider: "development", lines: [{ description: String(body.description || "Manual invoice"), amount: Number(body.amountCents || 0) }] }).returning();
      await notify(String(body.userId), "billing", "New invoice issued", `${inv.number} — development billing record.`, "/app/billing");
      return ok({ invoice: inv });
    }
  }

  if (resource === "support") {
    const [c] = await db.select().from(S.conversations).where(eq(S.conversations.id, String(body.id))).limit(1);
    if (!c) return fail("Conversation not found.");
    if (action === "reply") { await db.insert(S.messages).values({ conversationId: c.id, senderId: u.id, senderName: `${u.name} (Support)`, senderRole: "admin", body: String(body.message || "").slice(0, 5000) }); await db.update(S.conversations).set({ status: "Waiting for User", updatedAt: new Date() }).where(eq(S.conversations.id, c.id)); await notify(c.userId, "support", "Support replied to your conversation", c.subject, "/app/support"); return ok({}); }
    if (action === "note") { await db.insert(S.messages).values({ conversationId: c.id, senderId: u.id, senderName: `${u.name} (Internal)`, senderRole: "admin", body: String(body.message || "").slice(0, 5000), isInternal: true }); return ok({}); }
    if (action === "status") { await db.update(S.conversations).set({ status: String(body.status), updatedAt: new Date() }).where(eq(S.conversations.id, c.id)); return ok({}); }
    if (action === "priority") { await db.update(S.conversations).set({ priority: String(body.priority), updatedAt: new Date() }).where(eq(S.conversations.id, c.id)); return ok({}); }
    if (action === "assign") { await db.update(S.conversations).set({ assignedTo: body.assigneeId || null, updatedAt: new Date() }).where(eq(S.conversations.id, c.id)); return ok({}); }
  }

  if (resource === "settings") {
    if (!fullAdmin(u)) return fail("Full administrator access required.", 403);
    const key = String(body.key);
    if (!["app", "featureFlags", "providers", "cms"].includes(key)) return fail("Unknown settings group.");
    const [ex] = await db.select().from(S.settings).where(eq(S.settings.key, key)).limit(1);
    if (ex) await db.update(S.settings).set({ value: body.value, updatedBy: u.id, updatedAt: new Date() }).where(eq(S.settings.key, key));
    else await db.insert(S.settings).values({ key, value: body.value, updatedBy: u.id });
    await audit(u, "admin.settings_update", "settings", key);
    return ok({});
  }

  if (resource === "broadcast") {
    if (!fullAdmin(u)) return fail("Full administrator access required.", 403);
    const all = await db.select().from(S.users).where(eq(S.users.status, "active"));
    for (const x of all) await notify(x.id, "announcement", String(body.title || "Announcement").slice(0, 120), String(body.body || "").slice(0, 500), String(body.link || "/app"));
    await audit(u, "admin.broadcast", "notification", "", { recipients: all.length });
    return ok({ recipients: all.length });
  }

  if (resource === "seed") {
    if (u.role !== "super_admin") return fail("Super administrator only.", 403);
    if (action === "reseedDemo") {
      // Resets the DEMO ACCOUNT's dataset back to the pristine 100 rows. Touches no other data.
      const [demoUser] = await db.select().from(S.users).where(eq(S.users.email, "demo@mondaybrief.ai")).limit(1);
      if (!demoUser) return fail("Demo account not found.");
      const [w] = await db.select().from(S.workspaces).where(eq(S.workspaces.ownerId, demoUser.id)).limit(1);
      const dss = await db.select().from(S.datasets).where(eq(S.datasets.workspaceId, w.id));
      const target = dss.find((d) => d.isDemo) || dss[0];
      if (!target) return fail("Demo dataset not found.");
      const { generateDemoRows } = await import("@/lib/demoData");
      const { saveDatasetRows } = await import("@/lib/server");
      const rows = generateDemoRows();
      await saveDatasetRows(target.id, rows, Object.keys(rows[0]));
      await db.delete(S.cleaningOps).where(eq(S.cleaningOps.datasetId, target.id));
      await audit(u, "admin.demo_reseed", "dataset", target.id, { rows: rows.length });
      return ok({ rows: rows.length });
    }
  }
  return fail("Unknown admin action.");
}
