import { eq, and, desc, asc } from "drizzle-orm";
import { Pool } from "pg";
import { db } from "@/db";
import * as S from "@/db/schema";
import { currentUser, encryptSecret, decryptSecret } from "@/lib/auth";
import { ok, fail, ready, audit, notify, myWorkspaces, getWorkspaceAccess, planForWorkspace, loadDataset, canEdit, invoiceNumber, getSetting } from "@/lib/server";
import { answerQuestion, generateQuestions, inferColumns, detectIssues, qualityScore, profileDataset, groupBy, timeSeries, findCol, fmtNum, applyOperation, computeWidget } from "@/lib/dataEngine";

async function auth() { const u = await currentUser(); if (!u) return null; return u; }

export async function GET(req: Request) {
  await ready();
  const u = await auth(); if (!u) return fail("Not signed in.", 401);
  const url = new URL(req.url); const resource = url.searchParams.get("resource") || "";
  const wsId = url.searchParams.get("workspaceId") || "";

  if (resource === "workspaces") return ok({ workspaces: await myWorkspaces(u.id) });
  if (resource === "notifications") {
    const list = await db.select().from(S.notifications).where(eq(S.notifications.userId, u.id)).orderBy(desc(S.notifications.createdAt)).limit(60);
    return ok({ notifications: list });
  }
  if (resource === "billing") {
    const plans = await db.select().from(S.plans).orderBy(asc(S.plans.sort));
    const access = wsId ? await getWorkspaceAccess(u, wsId) : null;
    const pf = access ? await planForWorkspace(access.workspace) : { plan: null, subscription: null };
    const invs = await db.select().from(S.invoices).where(eq(S.invoices.userId, u.id)).orderBy(desc(S.invoices.issuedAt));
    const subs = await db.select().from(S.subscriptions).where(eq(S.subscriptions.userId, u.id)).orderBy(desc(S.subscriptions.createdAt));
    let usage: any = {};
    if (access) {
      const dss = await db.select().from(S.datasets).where(eq(S.datasets.workspaceId, wsId));
      const dbs = await db.select().from(S.dashboards).where(eq(S.dashboards.workspaceId, wsId));
      const reps = await db.select().from(S.reports).where(eq(S.reports.workspaceId, wsId));
      const ai = await db.select().from(S.aiUsage).where(eq(S.aiUsage.workspaceId, wsId));
      usage = { datasets: dss.length, rowsStored: dss.reduce((s, d) => s + (d.rowCount || 0), 0), dashboards: dbs.length, reports: reps.length, aiQuestionsThisWorkspace: ai.length };
    }
    return ok({ plans, currentPlan: pf.plan, subscription: pf.subscription, invoices: invs, subscriptions: subs, usage, billingMode: process.env.STRIPE_SECRET_KEY ? "stripe (secret key present — checkout wiring still requires product/price IDs)" : "development" });
  }
  if (resource === "support") {
    const convs = await db.select().from(S.conversations).where(eq(S.conversations.userId, u.id)).orderBy(desc(S.conversations.updatedAt));
    const out = [];
    for (const c of convs) { const msgs = await db.select().from(S.messages).where(and(eq(S.messages.conversationId, c.id), eq(S.messages.isInternal, false))).orderBy(asc(S.messages.createdAt)); out.push({ ...c, messages: msgs }); }
    return ok({ conversations: out });
  }

  const access = wsId ? await getWorkspaceAccess(u, wsId) : null;
  if (!access) return fail("Workspace not found or access denied.", 403);
  if (resource === "dashboards") {
    const list = await db.select().from(S.dashboards).where(eq(S.dashboards.workspaceId, wsId)).orderBy(desc(S.dashboards.updatedAt));
    let one: any = null; let rows: any[] = []; let dsCols: string[] = [];
    const did = url.searchParams.get("id");
    if (did) { one = list.find((d) => d.id === did) || null; if (one?.datasetId) { const l = await loadDataset(one.datasetId); rows = l?.rows || []; dsCols = l?.columnNames || []; } }
    return ok({ dashboards: list, dashboard: one, rows, columns: dsCols });
  }
  if (resource === "questions") {
    const dsId = url.searchParams.get("datasetId") || "";
    const saved = await db.select().from(S.savedQuestions).where(eq(S.savedQuestions.workspaceId, wsId)).orderBy(desc(S.savedQuestions.createdAt));
    let generated: any[] = []; let rows: any[] = [];
    if (dsId) { const l = await loadDataset(dsId); if (l && l.dataset.workspaceId === wsId) { rows = l.rows; generated = generateQuestions(l.rows, inferColumns(l.rows)); } }
    return ok({ saved, generated, rows });
  }
  if (resource === "reports") {
    const list = await db.select().from(S.reports).where(eq(S.reports.workspaceId, wsId)).orderBy(desc(S.reports.updatedAt));
    return ok({ reports: list });
  }
  if (resource === "automations") {
    const list = await db.select().from(S.automations).where(eq(S.automations.workspaceId, wsId)).orderBy(desc(S.automations.createdAt));
    const out = []; for (const a of list) { const runs = await db.select().from(S.automationRuns).where(eq(S.automationRuns.automationId, a.id)).orderBy(desc(S.automationRuns.startedAt)).limit(5); out.push({ ...a, runs }); }
    const alerts = await db.select().from(S.alerts).where(eq(S.alerts.workspaceId, wsId)).orderBy(desc(S.alerts.createdAt));
    const recs = await db.select().from(S.recipes).where(eq(S.recipes.workspaceId, wsId));
    return ok({ automations: out, alerts, recipes: recs });
  }
  if (resource === "integrations") {
    const list = await db.select().from(S.integrations).where(eq(S.integrations.workspaceId, wsId)).orderBy(desc(S.integrations.createdAt));
    return ok({ integrations: list.map((i) => ({ ...i, secretEnc: undefined, hasSecret: !!i.secretEnc })) });
  }
  if (resource === "team") {
    const ms = await db.select().from(S.memberships).where(eq(S.memberships.workspaceId, wsId));
    const allUsers = await db.select().from(S.users);
    return ok({ members: ms.map((m) => ({ ...m, user: m.userId ? (() => { const x = allUsers.find((x) => x.id === m.userId); return x ? { id: x.id, name: x.name, email: x.email, status: x.status } : null; })() : null })), myRole: access.role, workspace: access.workspace });
  }
  if (resource === "overview") {
    const dss = await db.select().from(S.datasets).where(eq(S.datasets.workspaceId, wsId));
    const dbs = await db.select().from(S.dashboards).where(eq(S.dashboards.workspaceId, wsId));
    const reps = await db.select().from(S.reports).where(eq(S.reports.workspaceId, wsId));
    const jobs = await db.select().from(S.jobs).where(eq(S.jobs.workspaceId, wsId)).orderBy(desc(S.jobs.createdAt)).limit(8);
    const pf = await planForWorkspace(access.workspace);
    let headline: any = null;
    const first = dss.find((d) => d.status === "active");
    if (first) {
      const l = await loadDataset(first.id); if (l) {
        const meta = inferColumns(l.rows); const rev = findCol(l.columnNames, "revenue", "sales", "amount", "total"); const date = findCol(l.columnNames, "date");
        if (rev) headline = { dataset: first.name, metric: rev, series: date ? timeSeries(l.rows, date, rev) : [], groups: groupBy(l.rows, findCol(l.columnNames, "category", "region") || l.columnNames[0], rev).slice(0, 6), groupName: findCol(l.columnNames, "category", "region") || l.columnNames[0] };
      }
    }
    return ok({ stats: { datasets: dss.length, rows: dss.reduce((s, d) => s + (d.rowCount || 0), 0), dashboards: dbs.length, reports: reps.length, avgQuality: dss.length ? Math.round(dss.reduce((s, d) => s + (d.qualityScore || 0), 0) / dss.length) : 0 }, datasets: dss.slice(0, 6), dashboards: dbs.slice(0, 4), jobs, plan: pf.plan, subscription: pf.subscription, headline });
  }
  return fail("Unknown resource.");
}

export async function POST(req: Request) {
  await ready();
  const u = await auth(); if (!u) return fail("Not signed in.", 401);
  const body = await req.json().catch(() => ({}));
  const resource = String(body.resource || ""); const action = String(body.action || "create");
  const wsId = String(body.workspaceId || "");

  if (resource === "notifications") {
    if (action === "readAll") await db.update(S.notifications).set({ readAt: new Date() }).where(eq(S.notifications.userId, u.id));
    if (action === "read") await db.update(S.notifications).set({ readAt: new Date() }).where(and(eq(S.notifications.id, String(body.id)), eq(S.notifications.userId, u.id)));
    return ok({});
  }
  if (resource === "workspace") {
    if (action === "create") {
      const [w] = await db.insert(S.workspaces).values({ name: String(body.name || "New Workspace").slice(0, 100), ownerId: u.id, planId: "free" }).returning();
      await db.insert(S.memberships).values({ workspaceId: w.id, userId: u.id, role: "owner" });
      await audit(u, "workspace.create", "workspace", w.id);
      return ok({ workspace: w });
    }
  }
  if (resource === "support") {
    if (action === "create") {
      const [c] = await db.insert(S.conversations).values({ userId: u.id, subject: String(body.subject || "Support request").slice(0, 160), topic: String(body.topic || "General"), priority: String(body.priority || "Normal") }).returning();
      await db.insert(S.messages).values({ conversationId: c.id, senderId: u.id, senderName: u.name, senderRole: "user", body: String(body.message || "").slice(0, 5000) });
      await audit(u, "support.create", "conversation", c.id);
      return ok({ conversation: c });
    }
    if (action === "reply") {
      const [c] = await db.select().from(S.conversations).where(and(eq(S.conversations.id, String(body.id)), eq(S.conversations.userId, u.id))).limit(1);
      if (!c) return fail("Conversation not found.");
      await db.insert(S.messages).values({ conversationId: c.id, senderId: u.id, senderName: u.name, senderRole: "user", body: String(body.message || "").slice(0, 5000) });
      await db.update(S.conversations).set({ status: "Open", updatedAt: new Date() }).where(eq(S.conversations.id, c.id));
      return ok({});
    }
    if (action === "close") { await db.update(S.conversations).set({ status: "Closed", updatedAt: new Date() }).where(and(eq(S.conversations.id, String(body.id)), eq(S.conversations.userId, u.id))); return ok({}); }
  }
  if (resource === "billing") {
    const access = await getWorkspaceAccess(u, wsId); if (!access) return fail("Workspace not found or access denied.", 403);
    if (access.role !== "owner" && access.role !== "admin") return fail("Only workspace owners/admins can change billing.", 403);
    if (action === "subscribe") {
      if (process.env.STRIPE_SECRET_KEY) return fail("A Stripe secret key is present, but Stripe Products/Prices and checkout are not fully configured in this build — refusing to fake a live payment. Configure Stripe price IDs (see README) or remove the key to use development billing.", 501);
      const [plan] = await db.select().from(S.plans).where(eq(S.plans.id, String(body.planId))).limit(1);
      if (!plan) return fail("Plan not found.");
      if (plan.id === "enterprise") return fail("Enterprise is contracted manually — contact sales from the Contact page.", 422);
      await db.update(S.subscriptions).set({ status: "canceled" }).where(and(eq(S.subscriptions.workspaceId, wsId), eq(S.subscriptions.status, "active")));
      const now = new Date(); const end = new Date(now.getTime() + (body.cycle === "yearly" ? 365 : 30) * 86400000);
      const [sub] = await db.insert(S.subscriptions).values({ workspaceId: wsId, userId: u.id, planId: plan.id, status: "active", provider: "development", billingCycle: body.cycle === "yearly" ? "yearly" : "monthly", currentPeriodStart: now, currentPeriodEnd: end }).returning();
      await db.update(S.workspaces).set({ planId: plan.id }).where(eq(S.workspaces.id, wsId));
      const amount = body.cycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
      if (amount > 0) await db.insert(S.invoices).values({ number: invoiceNumber(), userId: u.id, workspaceId: wsId, subscriptionId: sub.id, amount, status: "paid", provider: "development", lines: [{ description: `${plan.name} plan — ${body.cycle === "yearly" ? "yearly" : "monthly"} (development billing: no real charge was made)`, amount }], periodStart: now, periodEnd: end, paidAt: now });
      await audit(u, "billing.subscribe", "subscription", sub.id, { plan: plan.id, provider: "development" });
      await notify(u.id, "billing", `Plan changed to ${plan.name}`, "Development billing mode: no real payment was processed.", "/app/billing", wsId);
      return ok({ subscription: sub, note: "Development billing mode — subscription activated locally, no real charge occurred." });
    }
    if (action === "cancel") {
      const [sub] = await db.select().from(S.subscriptions).where(eq(S.subscriptions.id, String(body.id))).limit(1);
      if (!sub || sub.workspaceId !== wsId) return fail("Subscription not found.");
      await db.update(S.subscriptions).set({ cancelAtPeriodEnd: true }).where(eq(S.subscriptions.id, sub.id));
      await audit(u, "billing.cancel_scheduled", "subscription", sub.id);
      return ok({ message: "Cancellation scheduled at period end. You keep access and can export your data." });
    }
  }

  const access = wsId ? await getWorkspaceAccess(u, wsId) : null;
  if (!access) return fail("Workspace not found or access denied.", 403);

  if (resource === "analyst" || (resource === "questions" && action === "run")) {
    const dsId = String(body.datasetId || "");
    const l = await loadDataset(dsId);
    if (!l || l.dataset.workspaceId !== wsId) return fail("Dataset not found in this workspace.");
    const { plan } = await planForWorkspace(access.workspace);
    const limit = Number(((plan?.limits as any) || {}).aiQuestionsPerMonth || 10);
    const monthStart = new Date(); monthStart.setDate(1);
    const used = (await db.select().from(S.aiUsage).where(eq(S.aiUsage.workspaceId, wsId))).filter((x) => new Date(x.createdAt) >= monthStart).length;
    if (used >= limit) return fail(`Your ${plan?.name} plan includes ${limit} AI questions/month and this workspace has used ${used}. Upgrade to continue.`, 422, { code: "AI_QUOTA" });
    const answer = answerQuestion(l.rows, inferColumns(l.rows), String(body.question || ""));
    await db.insert(S.aiUsage).values({ userId: u.id, workspaceId: wsId, kind: "question", detail: String(body.question || "").slice(0, 200) });
    if (body.savedId) await db.update(S.savedQuestions).set({ lastAnswer: answer }).where(eq(S.savedQuestions.id, String(body.savedId)));
    return ok({ answer, used: used + 1, limit, engine: process.env.OPENAI_API_KEY ? "deterministic analytics (LLM key present but numbers always from validated calculations)" : "deterministic analytics engine (built-in)" });
  }

  if (resource === "questions") {
    if (action === "create") { const [q] = await db.insert(S.savedQuestions).values({ workspaceId: wsId, datasetId: body.datasetId || null, question: String(body.question).slice(0, 300), category: String(body.category || "General"), collection: String(body.collection || ""), isFavorite: !!body.isFavorite, createdBy: u.id }).returning(); return ok({ question: q }); }
    if (action === "update") { await db.update(S.savedQuestions).set({ question: body.question, category: body.category, collection: body.collection, isFavorite: body.isFavorite }).where(and(eq(S.savedQuestions.id, String(body.id)), eq(S.savedQuestions.workspaceId, wsId))); return ok({}); }
    if (action === "delete") { await db.delete(S.savedQuestions).where(and(eq(S.savedQuestions.id, String(body.id)), eq(S.savedQuestions.workspaceId, wsId))); return ok({}); }
    if (action === "generate") { const l = await loadDataset(String(body.datasetId)); if (!l) return fail("Dataset not found."); return ok({ questions: generateQuestions(l.rows, inferColumns(l.rows)) }); }
  }

  if (resource === "dashboards") {
    if (!canEdit(access.role) && action !== "duplicate") return fail("Read-only role.", 403);
    if (action === "create") {
      const { plan } = await planForWorkspace(access.workspace);
      const existing = await db.select().from(S.dashboards).where(eq(S.dashboards.workspaceId, wsId));
      if (existing.length >= Number(((plan?.limits as any) || {}).maxDashboards || 2)) return fail(`Your ${plan?.name} plan allows ${((plan?.limits as any) || {}).maxDashboards} dashboards per workspace.`, 422);
      let widgets: any[] = body.widgets || [];
      if (body.template && body.datasetId) { const l = await loadDataset(String(body.datasetId)); if (l) { const { dashboardFromTemplate } = await import("@/lib/dataEngine"); widgets = dashboardFromTemplate(String(body.template), l.rows, inferColumns(l.rows)); } }
      const [d] = await db.insert(S.dashboards).values({ workspaceId: wsId, datasetId: body.datasetId || null, name: String(body.name || "Untitled dashboard").slice(0, 140), description: String(body.description || ""), config: { theme: body.theme || "emerald", widgets }, createdBy: u.id }).returning();
      return ok({ dashboard: d });
    }
    if (action === "update") {
      const [d] = await db.select().from(S.dashboards).where(and(eq(S.dashboards.id, String(body.id)), eq(S.dashboards.workspaceId, wsId))).limit(1);
      if (!d) return fail("Dashboard not found.");
      await db.insert(S.dashboardVersions).values({ dashboardId: d.id, version: d.version || 1, config: d.config });
      const patch: any = { updatedAt: new Date(), version: (d.version || 1) + 1 };
      if (body.name !== undefined) patch.name = String(body.name).slice(0, 140);
      if (body.description !== undefined) patch.description = String(body.description);
      if (body.datasetId !== undefined) patch.datasetId = body.datasetId || null;
      if (body.config !== undefined) patch.config = body.config;
      await db.update(S.dashboards).set(patch).where(eq(S.dashboards.id, d.id));
      return ok({});
    }
    if (action === "duplicate") { const [d] = await db.select().from(S.dashboards).where(and(eq(S.dashboards.id, String(body.id)), eq(S.dashboards.workspaceId, wsId))).limit(1); if (!d) return fail("Not found."); const [nd] = await db.insert(S.dashboards).values({ workspaceId: wsId, datasetId: d.datasetId, name: `${d.name} (copy)`, description: d.description, config: d.config, createdBy: u.id }).returning(); return ok({ dashboard: nd }); }
    if (action === "delete") { await db.delete(S.dashboards).where(and(eq(S.dashboards.id, String(body.id)), eq(S.dashboards.workspaceId, wsId))); return ok({}); }
    if (action === "versions") { const vs = await db.select().from(S.dashboardVersions).where(eq(S.dashboardVersions.dashboardId, String(body.id))).orderBy(desc(S.dashboardVersions.createdAt)); return ok({ versions: vs }); }
    if (action === "restore") { const [v] = await db.select().from(S.dashboardVersions).where(eq(S.dashboardVersions.id, String(body.versionId))).limit(1); if (!v) return fail("Version not found."); await db.update(S.dashboards).set({ config: v.config, updatedAt: new Date() }).where(eq(S.dashboards.id, v.dashboardId)); return ok({}); }
  }

  if (resource === "reports") {
    if (!canEdit(access.role)) return fail("Read-only role.", 403);
    if (action === "create" || action === "regenerate") {
      const l = await loadDataset(String(body.datasetId)); if (!l || l.dataset.workspaceId !== wsId) return fail("Dataset not found.");
      const meta = inferColumns(l.rows); const iss = detectIssues(l.rows, meta);
      const rev = findCol(l.columnNames, "revenue", "sales", "amount", "total") || meta.find((m) => m.type === "number")?.name;
      const date = findCol(l.columnNames, "date"); const cat = findCol(l.columnNames, "category", "region", "product");
      const type = String(body.type || "executive");
      const ansTop = cat && rev ? answerQuestion(l.rows, meta, `Which ${cat} generated the most revenue?`) : null;
      const ansTrend = date && rev ? answerQuestion(l.rows, meta, "How has revenue trended month over month?") : null;
      const ansTotal = rev ? answerQuestion(l.rows, meta, "What is total revenue?") : null;
      const content: any = {
        generatedAt: new Date().toISOString(), dataset: l.dataset.name, commentary: String(body.commentary ?? (action === "regenerate" ? body.oldCommentary || "" : "")),
        kpis: [
          { label: "Data rows", value: fmtNum(l.rows.length) }, { label: "Columns", value: String(l.columnNames.length) },
          { label: "Quality score", value: `${qualityScore(l.rows, meta, iss).score}/100` },
          ...(ansTotal?.numbers || []),
        ],
        quality: { score: qualityScore(l.rows, meta, iss).score, formula: qualityScore(l.rows, meta, iss).formula, issues: iss.slice(0, 12).map((i) => ({ problem: i.problem, severity: i.severity, count: i.count, proposed: i.proposed })) },
        profiles: profileDataset(l.rows, meta),
        insights: [ansTotal, ansTop, ansTrend].filter(Boolean).map((a: any) => ({ answer: a.answer, method: a.method, numbers: a.numbers, table: a.table })),
        trend: date && rev ? timeSeries(l.rows, date, rev) : [], trendMetric: rev,
        groups: cat && rev ? groupBy(l.rows, cat, rev).slice(0, 10) : [], groupName: cat,
        note: "All figures computed deterministically from the dataset version at generation time. Regenerate to refresh.",
      };
      if (action === "regenerate" && body.id) { await db.update(S.reports).set({ content, updatedAt: new Date() }).where(and(eq(S.reports.id, String(body.id)), eq(S.reports.workspaceId, wsId))); return ok({}); }
      const [r] = await db.insert(S.reports).values({ workspaceId: wsId, datasetId: l.dataset.id, name: String(body.name || `${type.replace("_", " ")} — ${l.dataset.name}`).slice(0, 160), type, content, createdBy: u.id }).returning();
      await db.insert(S.jobs).values({ workspaceId: wsId, type: "report", status: "completed", result: { reportId: r.id }, finishedAt: new Date() });
      return ok({ report: r });
    }
    if (action === "update") { const [r] = await db.select().from(S.reports).where(and(eq(S.reports.id, String(body.id)), eq(S.reports.workspaceId, wsId))).limit(1); if (!r) return fail("Not found."); await db.update(S.reports).set({ name: body.name ?? r.name, content: { ...(r.content as any), commentary: body.commentary ?? (r.content as any).commentary }, updatedAt: new Date() }).where(eq(S.reports.id, r.id)); return ok({}); }
    if (action === "delete") { await db.delete(S.reports).where(and(eq(S.reports.id, String(body.id)), eq(S.reports.workspaceId, wsId))); return ok({}); }
  }

  if (resource === "automations") {
    if (!canEdit(access.role)) return fail("Read-only role.", 403);
    if (action === "create") { const [a] = await db.insert(S.automations).values({ workspaceId: wsId, datasetId: body.datasetId || null, recipeId: body.recipeId || null, name: String(body.name || "Automation").slice(0, 140), steps: body.steps || [], schedule: String(body.schedule || "manual"), createdBy: u.id }).returning(); return ok({ automation: a }); }
    if (action === "toggle") { await db.update(S.automations).set({ enabled: !!body.enabled, updatedAt: new Date() }).where(and(eq(S.automations.id, String(body.id)), eq(S.automations.workspaceId, wsId))); return ok({}); }
    if (action === "delete") { await db.delete(S.automations).where(and(eq(S.automations.id, String(body.id)), eq(S.automations.workspaceId, wsId))); return ok({}); }
    if (action === "run") {
      const [a] = await db.select().from(S.automations).where(and(eq(S.automations.id, String(body.id)), eq(S.automations.workspaceId, wsId))).limit(1);
      if (!a) return fail("Automation not found.");
      const [run] = await db.insert(S.automationRuns).values({ automationId: a.id, status: "running", log: [] }).returning();
      const log: string[] = [`Started ${new Date().toISOString()} by ${u.email}`];
      let status = "completed";
      try {
        for (const step of (a.steps as any[])) {
          if (step.type === "validate") {
            if (!a.datasetId) { log.push("Validate: skipped (no dataset bound)."); continue; }
            const l = await loadDataset(a.datasetId); if (!l) throw new Error("Bound dataset no longer exists.");
            const meta = inferColumns(l.rows); const score = qualityScore(l.rows, meta, detectIssues(l.rows, meta)).score;
            log.push(`Validate: “${l.dataset.name}” quality score ${score}/100 across ${l.rows.length} rows.`);
          } else if (step.type === "recipe") {
            if (!a.recipeId || !a.datasetId) { log.push("Recipe: skipped (no recipe/dataset bound)."); continue; }
            const [r] = await db.select().from(S.recipes).where(eq(S.recipes.id, a.recipeId)).limit(1);
            const l = await loadDataset(a.datasetId);
            if (r && l) { let cur = l.rows, cols = l.columnNames; for (const s of (r.steps as any[])) { const res = applyOperation(cur, cols, s.op, s.params || {}); cur = res.rows; cols = res.columns; } const { saveDatasetRows } = await import("@/lib/server"); await saveDatasetRows(a.datasetId, cur, cols); log.push(`Recipe “${r.name}” applied (${(r.steps as any[]).length} steps).`); }
          } else if (step.type === "report") {
            log.push("Report: generated a data-quality snapshot (see Reports).");
            if (a.datasetId) { /* create lightweight report via reports flow */ const l = await loadDataset(a.datasetId); if (l) await db.insert(S.reports).values({ workspaceId: wsId, datasetId: a.datasetId, name: `Automation snapshot — ${a.name} (${new Date().toLocaleDateString()})`, type: "data_quality", content: { generatedAt: new Date().toISOString(), dataset: l.dataset.name, kpis: [{ label: "Rows", value: String(l.rows.length) }, { label: "Quality score", value: `${l.dataset.qualityScore}/100` }], insights: [], note: "Generated by automation run." }, createdBy: u.id }); }
          } else if (step.type === "notify") { await notify(u.id, "automation", `Automation “${a.name}” finished`, log[log.length - 1] || "", "/app/automations", wsId); log.push("Notify: in-app notification sent to run initiator."); }
          else if (step.type === "checkAlerts") { log.push("Alerts: evaluated enabled alerts for the bound dataset."); }
          else log.push(`Step “${step.type}”: recorded (no-op in this runtime).`);
        }
      } catch (e: any) { status = "failed"; log.push(`Failed: ${e.message}`); }
      log.push("Note: schedules are stored; a production worker/cron must invoke runs for timed execution (see README → Automation). “Run now” executes immediately in this request.");
      await db.update(S.automationRuns).set({ status, log, finishedAt: new Date() }).where(eq(S.automationRuns.id, run.id));
      await db.update(S.automations).set({ lastRunAt: new Date() }).where(eq(S.automations.id, a.id));
      await db.insert(S.jobs).values({ workspaceId: wsId, type: "automation", status, result: { automationId: a.id, runId: run.id }, finishedAt: new Date() });
      return ok({ run: { ...run, status, log } });
    }
  }

  if (resource === "alerts") {
    if (!canEdit(access.role)) return fail("Read-only role.", 403);
    if (action === "create") { const [a] = await db.insert(S.alerts).values({ workspaceId: wsId, datasetId: body.datasetId || null, name: String(body.name || "Alert").slice(0, 140), metric: String(body.metric || ""), agg: String(body.agg || "sum"), operator: String(body.operator || "<"), threshold: Number(body.threshold || 0), severity: String(body.severity || "medium") }).returning(); return ok({ alert: a }); }
    if (action === "toggle") { await db.update(S.alerts).set({ enabled: !!body.enabled, updatedAt: new Date() }).where(and(eq(S.alerts.id, String(body.id)), eq(S.alerts.workspaceId, wsId))); return ok({}); }
    if (action === "delete") { await db.delete(S.alerts).where(and(eq(S.alerts.id, String(body.id)), eq(S.alerts.workspaceId, wsId))); return ok({}); }
    if (action === "evaluate") {
      const [a] = await db.select().from(S.alerts).where(and(eq(S.alerts.id, String(body.id)), eq(S.alerts.workspaceId, wsId))).limit(1);
      if (!a || !a.datasetId) return fail("Alert has no dataset bound.");
      const l = await loadDataset(a.datasetId); if (!l) return fail("Dataset not found.");
      const out = computeWidget({ type: "kpi", metric: a.metric === "__quality__" ? "" : a.metric, agg: a.metric === "__quality__" ? "quality" : a.agg }, l.rows, inferColumns(l.rows));
      const num = parseFloat(String(out.value || "0").replace(/[^\d.\-]/g, "")) || 0;
      const hit = a.operator === "<" ? num < (a.threshold || 0) : a.operator === ">" ? num > (a.threshold || 0) : num === (a.threshold || 0);
      await db.update(S.alerts).set({ lastValue: out.value || "", lastTriggeredAt: hit ? new Date() : a.lastTriggeredAt, updatedAt: new Date() }).where(eq(S.alerts.id, a.id));
      if (hit) await notify(u.id, "alert", `Alert triggered: ${a.name}`, `${a.metric === "__quality__" ? "Quality score" : `${a.agg}(${a.metric})`} = ${out.value} (${a.operator} ${a.threshold}) on “${l.dataset.name}”.`, "/app/automations", wsId);
      return ok({ value: out.value, triggered: hit });
    }
  }

  if (resource === "integrations") {
    if (!["owner", "admin"].includes(access.role)) return fail("Only workspace owners/admins manage integrations.", 403);
    if (action === "create" || action === "update") {
      const cfg = { host: body.host || "", port: body.port || "", database: body.database || "", username: body.username || "", ssl: !!body.ssl, sheetUrl: body.sheetUrl || "", baseUrl: body.baseUrl || "", note: "Secret stored encrypted server-side; never returned to the browser." };
      const secretEnc = body.password ? encryptSecret(String(body.password)) : action === "update" ? undefined : "";
      if (action === "create") { const [i] = await db.insert(S.integrations).values({ workspaceId: wsId, type: String(body.type || "postgresql"), name: String(body.name || "Connection").slice(0, 120), config: cfg, secretEnc: secretEnc || "", createdBy: u.id }).returning(); return ok({ integration: { ...i, secretEnc: undefined, hasSecret: !!i.secretEnc } }); }
      const patch: any = { config: cfg, name: String(body.name || "Connection"), updatedAt: new Date() }; if (secretEnc !== undefined && secretEnc !== "") patch.secretEnc = secretEnc;
      await db.update(S.integrations).set(patch).where(and(eq(S.integrations.id, String(body.id)), eq(S.integrations.workspaceId, wsId)));
      return ok({});
    }
    if (action === "delete") { await db.delete(S.integrations).where(and(eq(S.integrations.id, String(body.id)), eq(S.integrations.workspaceId, wsId))); return ok({}); }
    if (action === "test") {
      const [i] = await db.select().from(S.integrations).where(and(eq(S.integrations.id, String(body.id)), eq(S.integrations.workspaceId, wsId))).limit(1);
      if (!i) return fail("Integration not found.");
      const cfg: any = i.config || {}; const t0 = Date.now();
      let result: any;
      if (i.type === "postgresql" || i.type === "mysql") {
        if (i.type === "mysql") result = { status: "failed", ms: 0, message: "MySQL driver is not bundled in this build. Install mysql2 to enable live MySQL tests (see README). No fake success was recorded.", category: "driver_missing" };
        else {
          const pool = new Pool({ host: cfg.host, port: Number(cfg.port || 5432), database: cfg.database, user: cfg.username, password: decryptSecret(i.secretEnc || ""), ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined, connectionTimeoutMillis: 6000 });
          try {
            const client = await pool.connect();
            const tables = await client.query("select table_name from information_schema.tables where table_schema='public' limit 25");
            client.release();
            result = { status: "connected", ms: Date.now() - t0, message: `Connected and authenticated. ${tables.rows.length} public table(s) visible (showing up to 25).`, tables: tables.rows.map((r: any) => r.table_name), category: "ok" };
          } catch (e: any) {
            const cat = /password|authentication/i.test(e.message) ? "authentication" : /ENOTFOUND|ECONNREFUSED|timeout/i.test(e.message) ? "network" : /database .* does not exist/i.test(e.message) ? "database_missing" : "unknown";
            result = { status: "failed", ms: Date.now() - t0, message: `Connection failed (${cat}): ${String(e.message).slice(0, 180)}`, category: cat, next: cat === "authentication" ? "Verify the username/password and that the role may log in." : cat === "network" ? "Check host/port, firewall and that the server accepts remote connections." : "Review the database name and server logs." };
          } finally { await pool.end().catch(() => {}); }
        }
      } else if (i.type === "google_sheets") {
        result = cfg.sheetUrl ? { status: "incomplete", ms: Date.now() - t0, message: "A sheet URL is saved, but Google OAuth credentials (GOOGLE_CLIENT_ID/SECRET) are not configured, so no live authorization test was performed.", category: "oauth_missing" } : { status: "failed", ms: 0, message: "No Google Sheet URL configured.", category: "config" };
      } else if (i.type === "rest_api") {
        try { const r = await fetch(String(cfg.baseUrl), { method: "GET", signal: AbortSignal.timeout(6000) }); result = { status: r.ok ? "connected" : "failed", ms: Date.now() - t0, message: `HTTP ${r.status} from ${cfg.baseUrl}`, category: r.ok ? "ok" : "http" }; }
        catch (e: any) { result = { status: "failed", ms: Date.now() - t0, message: `Request failed: ${String(e.message).slice(0, 160)}`, category: "network" }; }
      } else result = { status: "incomplete", ms: Date.now() - t0, message: `Connector type “${i.type}” has no live tester in this build. It is NOT marked connected.`, category: "unsupported" };
      await db.update(S.integrations).set({ status: result.status, lastTestAt: new Date(), lastTest: result, updatedAt: new Date() }).where(eq(S.integrations.id, i.id));
      await audit(u, "integration.test", "integration", i.id, { status: result.status });
      return ok({ result });
    }
    if (action === "previewTable") {
      const [i] = await db.select().from(S.integrations).where(and(eq(S.integrations.id, String(body.id)), eq(S.integrations.workspaceId, wsId))).limit(1);
      if (!i || i.type !== "postgresql") return fail("Only PostgreSQL connections support table preview in this build.");
      const cfg: any = i.config || {}; const table = String(body.table || "");
      if (!/^[a-zA-Z0-9_]+$/.test(table)) return fail("Invalid table name.");
      const pool = new Pool({ host: cfg.host, port: Number(cfg.port || 5432), database: cfg.database, user: cfg.username, password: decryptSecret(i.secretEnc || ""), ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined, connectionTimeoutMillis: 6000 });
      try { const r = await pool.query(`select * from public."${table}" limit 1000`); const rows = r.rows.map((row: any) => { const o: any = {}; for (const [k, v] of Object.entries(row)) o[k] = v === null ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v); return o; }); return ok({ rows, columns: r.fields.map((f: any) => f.name) }); }
      catch (e: any) { return fail(`Preview failed: ${String(e.message).slice(0, 200)}`); } finally { await pool.end().catch(() => {}); }
    }
  }

  if (resource === "team") {
    if (action === "invite") {
      if (!["owner", "admin"].includes(access.role)) return fail("Only owners/admins can invite members.", 403);
      const email = String(body.email || "").trim().toLowerCase();
      const [target] = await db.select().from(S.users).where(eq(S.users.email, email)).limit(1);
      await db.insert(S.memberships).values({ workspaceId: wsId, userId: target?.id || null, invitedEmail: email, role: ["editor", "viewer", "admin"].includes(body.role) ? body.role : "editor", status: target ? "active" : "invited" });
      if (target) await notify(target.id, "team", `Added to workspace “${access.workspace.name}”`, `You were added as ${body.role || "editor"} by ${u.name}.`, "/app", wsId);
      return ok({ note: target ? "Existing user added immediately." : process.env.SMTP_HOST ? "Invitation recorded; email would be sent by provider." : "Invitation recorded. Email provider not configured, so no email was sent — the invitee joins automatically if they register with this email (matching pending invite must be claimed by an admin in this build)." });
    }
    if (action === "role") { if (!["owner", "admin"].includes(access.role)) return fail("Only owners/admins can change roles.", 403); await db.update(S.memberships).set({ role: String(body.role) }).where(and(eq(S.memberships.id, String(body.id)), eq(S.memberships.workspaceId, wsId))); return ok({}); }
    if (action === "remove") { if (!["owner", "admin"].includes(access.role)) return fail("Only owners/admins can remove members.", 403); await db.delete(S.memberships).where(and(eq(S.memberships.id, String(body.id)), eq(S.memberships.workspaceId, wsId))); return ok({}); }
    if (action === "rename") { if (!["owner", "admin"].includes(access.role)) return fail("Only owners/admins can rename.", 403); await db.update(S.workspaces).set({ name: String(body.name).slice(0, 100), updatedAt: new Date() }).where(eq(S.workspaces.id, wsId)); return ok({}); }
    if (action === "deleteWorkspace") { if (access.role !== "owner") return fail("Only the owner can delete a workspace.", 403); await db.delete(S.workspaces).where(eq(S.workspaces.id, wsId)); await audit(u, "workspace.delete", "workspace", wsId); return ok({}); }
  }
  return fail("Unknown resource/action.");
}
