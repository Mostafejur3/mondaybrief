import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { ok, ready, getSetting } from "@/lib/server";
import { DEFAULT_CMS } from "@/lib/seed";

export async function GET(req: Request) {
  await ready();
  const url = new URL(req.url);
  if (url.searchParams.get("health")) {
    const t0 = Date.now();
    try { await db.select().from(plans).limit(1); return ok({ status: "operational", dbLatencyMs: Date.now() - t0, checkedAt: new Date().toISOString(), providers: {
      email: process.env.SMTP_HOST ? "configured" : "not configured",
      payments: process.env.STRIPE_SECRET_KEY ? "Stripe key present" : "development mode",
      ai: process.env.OPENAI_API_KEY ? "external LLM key present" : "built-in deterministic engine",
    } }); }
    catch (e: any) { return ok({ status: "degraded", error: "Database check failed", checkedAt: new Date().toISOString() }); }
  }
  const allPlans = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sort));
  const cms = await getSetting("cms", DEFAULT_CMS);
  const app = await getSetting("app", {});
  return ok({ plans: allPlans, cms, demoRowLimit: app.demoRowLimit ?? 100, registrationOpen: app.registrationOpen !== false, billingMode: process.env.STRIPE_SECRET_KEY ? "stripe" : "development" });
}
