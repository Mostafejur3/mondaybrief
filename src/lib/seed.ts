import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as S from "@/db/schema";
import { hashPassword } from "./auth";
import { generateDemoRows, DEMO_COLUMNS } from "./demoData";
import { inferColumns, detectIssues, qualityScore, dashboardFromTemplate } from "./dataEngine";

let seeded = false; let seeding: Promise<void> | null = null;

export const PLAN_DEFS = [
  { id: "free", name: "Free", tagline: "Try the workspace", priceMonthly: 0, priceYearly: 0, sort: 0, limits: { maxRowsPerDataset: 1000, maxFileSizeMB: 5, maxDatasets: 3, maxDashboards: 2, aiQuestionsPerMonth: 10, maxReports: 2, automation: false, integrations: false }, features: ["100-row public demo", "3 datasets (up to 1,000 rows each)", "Core data cleaning", "2 dashboards", "10 AI questions / month", "CSV export"] },
  { id: "basic", name: "Basic", tagline: "For solo analysts", priceMonthly: 1900, priceYearly: 19000, sort: 1, limits: { maxRowsPerDataset: 10000, maxFileSizeMB: 25, maxDatasets: 20, maxDashboards: 10, aiQuestionsPerMonth: 100, maxReports: 20, automation: false, integrations: true }, features: ["20 datasets (up to 10,000 rows each)", "Full Cleaning Studio + recipes", "10 interactive dashboards", "100 AI questions / month", "CSV & XLSX export", "1 database integration"] },
  { id: "pro", name: "Pro", tagline: "For growing teams", priceMonthly: 4900, priceYearly: 49000, sort: 2, limits: { maxRowsPerDataset: 50000, maxFileSizeMB: 100, maxDatasets: 100, maxDashboards: 50, aiQuestionsPerMonth: 500, maxReports: 100, automation: true, integrations: true }, features: ["100 datasets (up to 50,000 rows each)", "Advanced cleaning + AI cleaning plans", "50 dashboards + theme editor", "Business Question Generator", "Automation & alerts", "Reports (PDF/CSV/XLSX)"] },
  { id: "business", name: "Business", tagline: "For companies", priceMonthly: 9900, priceYearly: 99000, sort: 3, limits: { maxRowsPerDataset: 200000, maxFileSizeMB: 250, maxDatasets: 500, maxDashboards: 250, aiQuestionsPerMonth: 2000, maxReports: 500, automation: true, integrations: true }, features: ["Team workspaces & roles", "Shared dashboards", "500 datasets (200k rows each)", "Scheduled automations", "Priority support queue", "All integrations"] },
  { id: "enterprise", name: "Enterprise", tagline: "Custom deployment", priceMonthly: 0, priceYearly: 0, sort: 4, limits: { maxRowsPerDataset: 1000000, maxFileSizeMB: 1024, maxDatasets: 10000, maxDashboards: 10000, aiQuestionsPerMonth: 100000, maxReports: 10000, automation: true, integrations: true }, features: ["Custom limits & governance", "Advanced permissions", "Dedicated support", "Custom retention policies", "Contact us for pricing"] },
];

export const DEFAULT_CMS = {
  heroHeadline: "Turn Messy Data Into Clear Business Decisions.",
  heroSub: "MondayBrief AI cleans, analyzes and visualizes your spreadsheets in one transparent workspace — review every fix before it applies, then ask questions answered from your actual numbers.",
  primaryCta: "Try the Free Demo", secondaryCta: "Explore Features",
  announcement: "Demo mode is open — explore a real 100-row dataset with no sign-up.",
  supportEmail: "support@mondaybrief.example", company: "MondayBrief AI",
  footerNote: "From messy data to meaningful decisions.",
  faq: [
    { q: "Which file formats are supported?", a: "CSV, TSV, TXT (delimited), JSON and XLSX are parsed with a preview step. Executables and unsupported formats are rejected. Very large files that exceed your plan's synchronous processing target are rejected with an explanation rather than silently truncated." },
    { q: "What can I do in the free demo?", a: "The public demo ships with a fictional 100-row e-commerce dataset. You can preview it, review detected quality issues, preview and apply cleaning operations, view analytics, interact with a dashboard and ask sample business questions. Server-side, demo processing is capped at 100 rows." },
    { q: "Does the AI invent numbers?", a: "No. Answers are produced by a deterministic analytical layer that runs validated calculations on your rows. Every answer shows the method, source columns, period and assumptions. If a question cannot be established from the data, the assistant says so." },
    { q: "Is my data private?", a: "Datasets belong to a workspace and are enforced server-side — other users cannot read them. Numerical answers never require sending raw rows to an external AI provider. You can delete files and derived data at any time." },
    { q: "Can I cancel anytime?", a: "Yes. Cancelling keeps the plan active until the end of the paid period and you always keep access to export your own data." },
    { q: "Do you offer refunds?", a: "Refunds follow the billing provider's process once live payments are configured. In development billing mode no real charge is ever made." },
  ],
};
export const DEFAULT_SETTINGS: Record<string, any> = {
  app: { demoRowLimit: 100, maxUploadMB: 25, maintenanceMode: false, registrationOpen: true, trialsEnabled: true, defaultTheme: "light", standardProcessingTargetRows: 10000, allowedFormats: ["csv", "tsv", "txt", "json", "xlsx"] },
  featureFlags: { aiAnalyst: true, automations: true, integrations: true, publicDemo: true, registration: true, reports: true },
  providers: { aiProvider: "deterministic-engine (built-in)", aiModel: "validated analytics layer", emailProvider: process.env.SMTP_HOST ? "SMTP (configured via env)" : "Not configured — set SMTP_* env vars", paymentProvider: process.env.STRIPE_SECRET_KEY ? "Stripe (key present)" : "Development billing mode — no real charges", storage: "PostgreSQL row storage (object storage configurable for production)" },
  cms: DEFAULT_CMS,
};

export async function ensureSeed() {
  if (seeded) return;
  if (seeding) return seeding;
  seeding = (async () => {
    // plans
    for (const p of PLAN_DEFS) {
      const [ex] = await db.select().from(S.plans).where(eq(S.plans.id, p.id)).limit(1);
      if (!ex) await db.insert(S.plans).values(p as any);
    }
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      const [ex] = await db.select().from(S.settings).where(eq(S.settings.key, k)).limit(1);
      if (!ex) await db.insert(S.settings).values({ key: k, value: v });
    }
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@mondaybrief.ai").toLowerCase();
    const adminPw = process.env.ADMIN_PASSWORD || "Admin@12345";
    let [admin] = await db.select().from(S.users).where(eq(S.users.email, adminEmail)).limit(1);
    if (!admin) {
      [admin] = await db.insert(S.users).values({ name: "Platform Administrator", email: adminEmail, passwordHash: hashPassword(adminPw), role: "super_admin", emailVerified: true, company: "MondayBrief AI", jobTitle: "Administrator", isSeed: true }).returning();
      const [w] = await db.insert(S.workspaces).values({ name: "MondayBrief Operations", ownerId: admin.id, planId: "business" }).returning();
      await db.insert(S.memberships).values({ workspaceId: w.id, userId: admin.id, role: "owner" });
    }
    // demo account + sample customers (seed, fictional)
    let [demoUser] = await db.select().from(S.users).where(eq(S.users.email, "demo@mondaybrief.ai")).limit(1);
    if (!demoUser) {
      [demoUser] = await db.insert(S.users).values({ name: "Sarah Demo", email: "demo@mondaybrief.ai", passwordHash: hashPassword("Demo@12345"), role: "user", emailVerified: true, company: "Northwind Retail (fictional)", jobTitle: "E-commerce Manager", isSeed: true }).returning();
      const [w] = await db.insert(S.workspaces).values({ name: "Northwind Retail — Sample Workspace", ownerId: demoUser.id, planId: "pro" }).returning();
      await db.insert(S.memberships).values({ workspaceId: w.id, userId: demoUser.id, role: "owner" });
      const rows = generateDemoRows(); const meta = inferColumns(rows);
      const score = qualityScore(rows, meta, detectIssues(rows, meta)).score;
      const [f] = await db.insert(S.files).values({ workspaceId: w.id, uploadedBy: demoUser.id, name: "ecommerce_orders_2025.csv", type: "csv", sizeBytes: JSON.stringify(rows).length }).returning();
      const [ds] = await db.insert(S.datasets).values({ workspaceId: w.id, fileId: f.id, name: "E-commerce Orders 2025 (sample, 100 rows)", description: "Fictional sample dataset with documented data-quality issues for demonstration.", columns: meta, rowCount: rows.length, qualityScore: score, isDemo: true, source: "seed", createdBy: demoUser.id, tags: ["sales", "sample"] }).returning();
      await db.insert(S.datasetRows).values(rows.map((r, i) => ({ datasetId: ds.id, rowIndex: i, data: r })));
      await db.insert(S.dashboards).values({ workspaceId: w.id, datasetId: ds.id, name: "Sales Performance (sample)", description: "Built from the Executive/Sales template against the sample dataset.", config: { theme: "emerald", widgets: dashboardFromTemplate("sales", rows, meta) }, createdBy: demoUser.id });
      const now = new Date(); const end = new Date(now.getTime() + 30 * 86400000);
      const [sub] = await db.insert(S.subscriptions).values({ workspaceId: w.id, userId: demoUser.id, planId: "pro", status: "active", provider: "development", currentPeriodStart: now, currentPeriodEnd: end }).returning();
      await db.insert(S.invoices).values({ number: "INV-2026-000101", userId: demoUser.id, workspaceId: w.id, subscriptionId: sub.id, amount: 4900, status: "paid", provider: "development", lines: [{ description: "Pro plan — monthly (development billing, no real charge)", amount: 4900 }], periodStart: now, periodEnd: end, paidAt: now });
      const [conv] = await db.insert(S.conversations).values({ userId: demoUser.id, subject: "How do I standardize mixed date formats?", topic: "Data cleaning", status: "Open" }).returning();
      await db.insert(S.messages).values({ conversationId: conv.id, senderId: demoUser.id, senderName: demoUser.name, senderRole: "user", body: "Hi! My Order Date column mixes 2025-08-01, 08/01/2025 and 01.08.2025. Can MondayBrief normalize them without guessing invalid ones?" });
      await db.insert(S.notifications).values({ userId: demoUser.id, workspaceId: w.id, type: "info", title: "Welcome to MondayBrief AI", body: "Your sample workspace is ready: 100-row dataset, a sales dashboard and a support thread.", link: "/app" });
      await db.insert(S.savedQuestions).values({ workspaceId: w.id, datasetId: ds.id, question: "Which product generated the most revenue?", category: "Products", isFavorite: true, createdBy: demoUser.id });
      await db.insert(S.automations).values({ workspaceId: w.id, datasetId: ds.id, name: "Weekly data-quality check", schedule: "weekly", steps: [{ type: "validate", label: "Validate dataset & recompute quality score" }, { type: "report", label: "Generate data-quality report" }, { type: "notify", label: "Notify workspace owner" }], createdBy: demoUser.id });
      // extra fictional customers for admin views
      const extra = [
        ["Liam O'Connor", "liam@harborgoods.example", "basic"], ["Priya Shah", "priya@shahconsult.example", "pro"],
        ["Mateo Ruiz", "mateo@ruizretail.example", "free"], ["Ingrid Berg", "ingrid@nordichome.example", "business"],
        ["Kenji Tanaka", "kenji@tanaka-studio.example", "basic"],
      ];
      let n = 102;
      for (const [name, email, plan] of extra) {
        const [u] = await db.insert(S.users).values({ name, email, passwordHash: hashPassword("Demo@12345"), emailVerified: true, isSeed: true, company: email.split("@")[1] }).returning();
        const [ww] = await db.insert(S.workspaces).values({ name: `${name.split(" ")[0]}'s Workspace`, ownerId: u.id, planId: plan }).returning();
        await db.insert(S.memberships).values({ workspaceId: ww.id, userId: u.id, role: "owner" });
        const planDef = PLAN_DEFS.find((p) => p.id === plan)!;
        const [s2] = await db.insert(S.subscriptions).values({ workspaceId: ww.id, userId: u.id, planId: plan, status: plan === "free" ? "active" : "active", provider: "development", currentPeriodStart: now, currentPeriodEnd: end }).returning();
        if (planDef.priceMonthly > 0) await db.insert(S.invoices).values({ number: `INV-2026-000${n++}`, userId: u.id, workspaceId: ww.id, subscriptionId: s2.id, amount: planDef.priceMonthly, status: "paid", provider: "development", lines: [{ description: `${planDef.name} plan — monthly (development billing)`, amount: planDef.priceMonthly }], periodStart: now, periodEnd: end, paidAt: now });
      }
      await db.insert(S.auditLogs).values({ actorEmail: "system", action: "seed.completed", entity: "system", metadata: { note: "Initial seed: plans, settings, admin, demo workspace with 100-row dataset, fictional customers." } });
    }
    seeded = true;
  })();
  try { await seeding; } catch (e) { seeding = null; throw e; }
}
