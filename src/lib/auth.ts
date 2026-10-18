import crypto from "crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { cookies } from "next/headers";

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  if (!stored?.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const attempt = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), attempt);
}
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const hashToken = sha;

export async function createSession(userId: string, req: Request) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.insert(sessions).values({ userId, tokenHash: sha(token), expiresAt, ip: req.headers.get("x-forwarded-for") || "", userAgent: req.headers.get("user-agent") || "" });
  const store = await cookies();
  store.set("mb_session", token, { httpOnly: true, sameSite: "lax", path: "/", expires: expiresAt });
  return token;
}
export async function destroySession() {
  const store = await cookies();
  const token = store.get("mb_session")?.value;
  if (token) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha(token)));
  store.delete("mb_session");
}
export async function currentUser() {
  const store = await cookies();
  const token = store.get("mb_session")?.value;
  if (!token) return null;
  const [s] = await db.select().from(sessions).where(and(eq(sessions.tokenHash, sha(token)), gt(sessions.expiresAt, new Date()), isNull(sessions.revokedAt))).limit(1);
  if (!s) return null;
  const [u] = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
  if (!u || u.status === "suspended") return null;
  return u;
}
export const publicUser = (u: any) => u ? { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, company: u.company, jobTitle: u.jobTitle, language: u.language, timezone: u.timezone, theme: u.theme, emailVerified: u.emailVerified, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt } : null;
export const isAdmin = (u: any) => u && ["admin", "super_admin"].includes(u.role);

// Symmetric encryption for integration secrets (server-side only).
function encKey() { return crypto.createHash("sha256").update(process.env.ENCRYPTION_KEY || process.env.DATABASE_URL || "mondaybrief-dev-key").digest(); }
export function encryptSecret(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${enc.toString("hex")}`;
}
export function decryptSecret(stored: string): string {
  try {
    if (!stored) return "";
    const [iv, tag, data] = stored.split(".");
    const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(), Buffer.from(iv, "hex"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString("utf8");
  } catch { return ""; }
}
