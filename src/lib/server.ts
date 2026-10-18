import { NextResponse } from "next/server";
import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, memberships, workspaces, datasets, datasetRows, plans, subscriptions, notifications, settings } from "@/db/schema";
import { ensureSeed } from "./seed";
import { inferColumns, detectIssues, qualityScore, type Row } from "./dataEngine";

export const ok = (data: any, status = 200) => NextResponse.json({ ok: true, ...data }, { status });
export const fail = (message: string, status = 400, extra: any = {}) => NextResponse.json({ ok: false, error: message, ...extra }, { status });

export async function audit(user: any, action: string, entity = "", entityId = "", metadata: any = {}) {
  try { await db.insert(auditLogs).values({ userId: user?.id || null, actorEmail: user?.email || "anonymous", action, entity, entityId, metadata }); } catch {}
}
export async function notify(userId: string, type: string, title: string, body = "", link = "", workspaceId?: string) {
  try { await db.insert(notifications).values({ userId, type, title, body, link, workspaceId: workspaceId || null }); } catch {}
}

export async function ready() { await ensureSeed(); }

export async function myWorkspaces(userId: string) {
  const ms = await db.select().from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.status, "active")));
  if (!ms.length) return [];
  const all = await db.select().from(workspaces);
  return ms.map((m) => ({ ...all.find((w) => w.id === m.workspaceId), myRole: m.role })).filter((w) => w.id);
}
export async function getWorkspaceAccess(user: any, workspaceId: string) {
  const [m] = await db.select().from(memberships).where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, user.id), eq(memberships.status, "active"))).limit(1);
  if (!m && !["admin", "super_admin"].includes(user.role)) return null;
  const [w] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  return w ? { workspace: w, role: m?.role || "admin" } : null;
}
export async function planForWorkspace(w: any) {
  const [sub] = await db.select().from(subscriptions).where(and(eq(subscriptions.workspaceId, w.id), eq(subscriptions.status, "active"))).orderBy(desc(subscriptions.createdAt)).limit(1);
  const planId = sub?.planId || w.planId || "free";
  const [p] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  const [free] = await db.select().from(plans).where(eq(plans.id, "free")).limit(1);
  return { plan: p || free, subscription: sub || null };
}
export async function loadDataset(datasetId: string, withRows = true) {
  const [ds] = await db.select().from(datasets).where(eq(datasets.id, datasetId)).limit(1);
  if (!ds) return null;
  let rows: Row[] = [];
  if (withRows) {
    const rr = await db.select().from(datasetRows).where(eq(datasetRows.datasetId, datasetId)).orderBy(asc(datasetRows.rowIndex));
    rows = rr.map((r) => r.data as Row);
  }
  const columns = ((ds.columns as any[])?.length ? (ds.columns as any[]).map((c) => c.name) : rows[0] ? Object.keys(rows[0]) : []) as string[];
  return { dataset: ds, rows, columnNames: columns, columnsMeta: rows.length ? inferColumns(rows) : ((ds.columns as any[]) || []) };
}
export async function saveDatasetRows(datasetId: string, rows: Row[], columnNames: string[]) {
  await db.delete(datasetRows).where(eq(datasetRows.datasetId, datasetId));
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    await db.insert(datasetRows).values(rows.slice(i, i + chunk).map((r, j) => ({ datasetId, rowIndex: i + j, data: r })));
  }
  const meta = inferColumns(rows);
  const score = rows.length ? qualityScore(rows, meta, detectIssues(rows, meta)).score : 0;
  await db.update(datasets).set({ columns: meta.map((m) => ({ name: m.name, type: m.type })), rowCount: rows.length, qualityScore: score, updatedAt: new Date() }).where(eq(datasets.id, datasetId));
  return score;
}
export async function getSetting(key: string, fallback: any = null) {
  const [s] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return s ? s.value : fallback;
}
export const canEdit = (role: string) => ["owner", "admin", "editor"].includes(role);
export function invoiceNumber() { return `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; }
