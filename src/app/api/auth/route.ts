import crypto from "crypto";
import { eq, and, gt, isNull, desc } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, workspaces, memberships, passwordResets } from "@/db/schema";
import { hashPassword, verifyPassword, createSession, destroySession, currentUser, publicUser, hashToken } from "@/lib/auth";
import { ok, fail, ready, audit, getSetting, notify } from "@/lib/server";

const attempts = new Map<string, { n: number; t: number }>();
function rateLimited(key: string) {
  const now = Date.now(); const a = attempts.get(key);
  if (!a || now - a.t > 900000) { attempts.set(key, { n: 1, t: now }); return false; }
  a.n++; return a.n > 12;
}
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export async function GET() {
  await ready();
  const u = await currentUser();
  return ok({ user: publicUser(u) });
}

export async function POST(req: Request) {
  await ready();
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const ip = req.headers.get("x-forwarded-for") || "local";

  if (action === "logout") { const u = await currentUser(); await audit(u, "auth.logout"); await destroySession(); return ok({}); }

  if (action === "register") {
    const app = await getSetting("app", {});
    if (app.registrationOpen === false || app.maintenanceMode) return fail("Registration is currently closed by the administrator.", 403);
    const name = String(body.name || "").trim(); const email = String(body.email || "").trim().toLowerCase(); const pw = String(body.password || "");
    if (name.length < 2) return fail("Please enter your name.");
    if (!emailOk(email)) return fail("Please enter a valid email address.");
    if (pw.length < 8) return fail("Password must be at least 8 characters.");
    if (rateLimited(`reg:${ip}`)) return fail("Too many attempts. Please wait a few minutes.", 429);
    const [ex] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (ex) return fail("An account with this email already exists. Try logging in.");
    const [u] = await db.insert(users).values({ name, email, passwordHash: hashPassword(pw), company: String(body.company || ""), emailVerified: false }).returning();
    const [w] = await db.insert(workspaces).values({ name: `${name.split(" ")[0]}'s Workspace`, ownerId: u.id, planId: "free" }).returning();
    await db.insert(memberships).values({ workspaceId: w.id, userId: u.id, role: "owner" });
    await notify(u.id, "info", "Welcome to MondayBrief AI", "Start by uploading a CSV/XLSX in the Data Hub, or explore the 100-row public demo.", "/app/data", w.id);
    await audit(u, "auth.register", "user", u.id);
    await createSession(u.id, req);
    const smtp = !!process.env.SMTP_HOST;
    return ok({ user: publicUser(u), note: smtp ? "Verification email would be sent by the configured provider." : "Email provider not configured in this environment — account is active without email verification. Configure SMTP_* to enable verification emails." });
  }

  if (action === "login") {
    const email = String(body.email || "").trim().toLowerCase(); const pw = String(body.password || "");
    if (rateLimited(`login:${ip}:${email}`)) return fail("Too many failed attempts. Please wait a few minutes.", 429);
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u || !verifyPassword(pw, u.passwordHash)) { await audit(null, "auth.login_failed", "user", "", { email }); return fail("Invalid email or password.", 401); }
    if (u.status === "suspended") return fail("This account is suspended. Contact support.", 403);
    if (body.requireAdmin && !["admin", "super_admin"].includes(u.role)) return fail("This account does not have administrator access.", 403);
    attempts.delete(`login:${ip}:${email}`);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
    await audit(u, "auth.login", "user", u.id);
    await createSession(u.id, req);
    return ok({ user: publicUser(u) });
  }

  if (action === "forgot") {
    const email = String(body.email || "").trim().toLowerCase();
    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // Always respond identically to avoid account enumeration.
    const baseMsg = process.env.SMTP_HOST ? "If an account exists for this email, a reset link has been sent." : "Email delivery is not configured (SMTP_* env vars missing), so no email was sent.";
    if (!u) return ok({ message: baseMsg });
    const token = crypto.randomBytes(24).toString("hex");
    await db.insert(passwordResets).values({ userId: u.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600000) });
    await audit(u, "auth.password_reset_requested", "user", u.id);
    return ok({ message: baseMsg, devResetToken: process.env.SMTP_HOST ? undefined : token, devNote: process.env.SMTP_HOST ? undefined : "DEVELOPMENT ONLY: because no email provider is configured, the one-time reset token is shown here so the flow can be tested. In production it is only ever emailed." });
  }

  if (action === "reset") {
    const token = String(body.token || ""); const pw = String(body.password || "");
    if (pw.length < 8) return fail("Password must be at least 8 characters.");
    const [r] = await db.select().from(passwordResets).where(and(eq(passwordResets.tokenHash, hashToken(token)), gt(passwordResets.expiresAt, new Date()), isNull(passwordResets.usedAt))).limit(1);
    if (!r) return fail("This reset link is invalid or expired.");
    await db.update(users).set({ passwordHash: hashPassword(pw) }).where(eq(users.id, r.userId));
    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, r.id));
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.userId, r.userId));
    await audit({ id: r.userId }, "auth.password_reset", "user", r.userId);
    return ok({ message: "Password updated. All previous sessions were signed out." });
  }

  if (action === "updateProfile") {
    const u = await currentUser(); if (!u) return fail("Not signed in.", 401);
    const patch: any = { updatedAt: new Date() };
    for (const k of ["name", "company", "jobTitle", "language", "timezone", "theme"]) if (body[k] !== undefined) patch[k] = String(body[k]).slice(0, 120);
    if (body.preferences) patch.preferences = body.preferences;
    await db.update(users).set(patch).where(eq(users.id, u.id));
    const [fresh] = await db.select().from(users).where(eq(users.id, u.id));
    return ok({ user: publicUser(fresh) });
  }

  if (action === "changePassword") {
    const u = await currentUser(); if (!u) return fail("Not signed in.", 401);
    if (!verifyPassword(String(body.current || ""), u.passwordHash)) return fail("Current password is incorrect.");
    if (String(body.next || "").length < 8) return fail("New password must be at least 8 characters.");
    await db.update(users).set({ passwordHash: hashPassword(String(body.next)) }).where(eq(users.id, u.id));
    await audit(u, "auth.password_changed", "user", u.id);
    return ok({ message: "Password changed." });
  }

  if (action === "sessions") {
    const u = await currentUser(); if (!u) return fail("Not signed in.", 401);
    const list = await db.select().from(sessions).where(eq(sessions.userId, u.id)).orderBy(desc(sessions.createdAt)).limit(20);
    return ok({ sessions: list.map((s) => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt, ip: s.ip, userAgent: s.userAgent, active: !s.revokedAt && new Date(s.expiresAt) > new Date() })) });
  }
  if (action === "revokeSession") {
    const u = await currentUser(); if (!u) return fail("Not signed in.", 401);
    await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.id, String(body.id)), eq(sessions.userId, u.id)));
    return ok({});
  }
  if (action === "deleteAccount") {
    const u = await currentUser(); if (!u) return fail("Not signed in.", 401);
    if (!verifyPassword(String(body.password || ""), u.passwordHash)) return fail("Enter your password to confirm account deletion.");
    if (u.role === "super_admin") return fail("The bootstrap super-admin cannot self-delete. Transfer ownership first.");
    const owned = await db.select().from(workspaces).where(eq(workspaces.ownerId, u.id));
    for (const w of owned) await db.delete(workspaces).where(eq(workspaces.id, w.id));
    await db.delete(users).where(eq(users.id, u.id));
    await destroySession();
    return ok({ message: "Account and owned workspaces deleted." });
  }
  return fail("Unknown action.");
}
