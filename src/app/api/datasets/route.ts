import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { datasets, files, jobs } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { ok, fail, ready, audit, getWorkspaceAccess, planForWorkspace, saveDatasetRows, canEdit, notify } from "@/lib/server";
import type { Row } from "@/lib/dataEngine";

export async function GET(req: Request) {
  await ready();
  const u = await currentUser(); if (!u) return fail("Not signed in.", 401);
  const wsId = new URL(req.url).searchParams.get("workspaceId") || "";
  const access = await getWorkspaceAccess(u, wsId); if (!access) return fail("Workspace not found or access denied.", 403);
  const list = await db.select().from(datasets).where(eq(datasets.workspaceId, wsId)).orderBy(desc(datasets.updatedAt));
  const fileList = await db.select().from(files).where(eq(files.workspaceId, wsId)).orderBy(desc(files.createdAt));
  return ok({ datasets: list, files: fileList });
}

export async function POST(req: Request) {
  await ready();
  const u = await currentUser(); if (!u) return fail("Not signed in.", 401);
  const body = await req.json().catch(() => ({}));
  const access = await getWorkspaceAccess(u, String(body.workspaceId || ""));
  if (!access) return fail("Workspace not found or access denied.", 403);
  if (!canEdit(access.role)) return fail("Your workspace role is read-only (viewer).", 403);
  const rowsIn = Array.isArray(body.rows) ? body.rows : [];
  if (!rowsIn.length) return fail("No data rows were found in this file. Check the header row / sheet selection and try again.");
  const { plan } = await planForWorkspace(access.workspace);
  const limits: any = plan?.limits || {};
  const maxRows = Number(limits.maxRowsPerDataset || 1000);
  if (rowsIn.length > maxRows) return fail(`Your ${plan?.name || "current"} plan allows up to ${maxRows.toLocaleString()} rows per dataset for synchronous processing. This file has ${rowsIn.length.toLocaleString()} rows — it was rejected, not truncated. Upgrade or split the file.`, 422, { code: "PLAN_ROW_LIMIT", limit: maxRows });
  const existing = await db.select().from(datasets).where(eq(datasets.workspaceId, access.workspace.id));
  if (existing.length >= Number(limits.maxDatasets || 3)) return fail(`Your ${plan?.name || "current"} plan allows ${limits.maxDatasets} datasets in this workspace. Delete one or upgrade.`, 422, { code: "PLAN_DATASET_LIMIT" });
  const rows: Row[] = rowsIn.map((r: any) => { const o: Row = {}; for (const [k, v] of Object.entries(r || {})) o[String(k).slice(0, 80) || "column"] = v === null || v === undefined ? "" : String(v).slice(0, 5000); return o; });
  const columns = Object.keys(rows[0]);
  const [f] = await db.insert(files).values({ workspaceId: access.workspace.id, uploadedBy: u.id, name: String(body.fileName || "dataset"), type: String(body.fileType || "csv"), sizeBytes: Number(body.sizeBytes || 0) }).returning();
  const [ds] = await db.insert(datasets).values({ workspaceId: access.workspace.id, fileId: f.id, name: String(body.name || body.fileName || "Dataset").slice(0, 140), description: String(body.description || ""), columns: [], sheetName: String(body.sheetName || ""), source: "upload", createdBy: u.id, tags: Array.isArray(body.tags) ? body.tags : [] }).returning();
  const score = await saveDatasetRows(ds.id, rows, columns);
  await db.insert(jobs).values({ workspaceId: access.workspace.id, type: "import", status: "completed", result: { datasetId: ds.id, rows: rows.length, qualityScore: score }, finishedAt: new Date() });
  await audit(u, "dataset.import", "dataset", ds.id, { rows: rows.length, file: f.name });
  await notify(u.id, "success", "Dataset imported", `“${ds.name}” imported with ${rows.length} rows. Quality score ${score}/100.`, `/app/datasets/${ds.id}`, access.workspace.id);
  return ok({ dataset: { ...ds, qualityScore: score, rowCount: rows.length }, file: f });
}
