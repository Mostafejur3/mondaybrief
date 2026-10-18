import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { datasets, cleaningOps, recipes, dashboards, jobs } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { ok, fail, ready, audit, getWorkspaceAccess, loadDataset, saveDatasetRows, canEdit, planForWorkspace } from "@/lib/server";
import { applyOperation, detectIssues, profileDataset, qualityScore, inferColumns, groupBy, timeSeries, correlate, generateQuestions, type Row } from "@/lib/dataEngine";

async function ctx(id: string) {
  const u = await currentUser(); if (!u) return { error: fail("Not signed in.", 401) };
  const loaded = await loadDataset(id);
  if (!loaded) return { error: fail("Dataset not found.", 404) };
  const access = await getWorkspaceAccess(u, loaded.dataset.workspaceId);
  if (!access) return { error: fail("Access denied for this workspace.", 403) };
  return { u, ...loaded, access };
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const { id } = await params;
  const c = await ctx(id); if ((c as any).error) return (c as any).error;
  const { dataset, rows, columnNames } = c as any;
  const meta = inferColumns(rows);
  const issues = detectIssues(rows, meta);
  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "full";
  const history = await db.select({ id: cleaningOps.id, operation: cleaningOps.operation, params: cleaningOps.params, affectedRows: cleaningOps.affectedRows, affectedCells: cleaningOps.affectedCells, beforeScore: cleaningOps.beforeScore, afterScore: cleaningOps.afterScore, status: cleaningOps.status, createdAt: cleaningOps.createdAt }).from(cleaningOps).where(eq(cleaningOps.datasetId, id)).orderBy(desc(cleaningOps.createdAt)).limit(50);
  const recs = await db.select().from(recipes).where(eq(recipes.workspaceId, dataset.workspaceId));
  if (view === "analysis") {
    const numeric = meta.filter((m: any) => rows.some((r: Row) => r[m.name] !== "" && !isNaN(Number(String(r[m.name]).replace(/[$,%]/g, ""))))).map((m: any) => m.name);
    const dims = meta.filter((m: any) => m.type === "text").map((m: any) => m.name);
    const dateCol = meta.find((m: any) => m.type === "date" || /date/i.test(m.name))?.name;
    const correlations: any[] = [];
    for (let i = 0; i < Math.min(numeric.length, 6); i++) for (let j = i + 1; j < Math.min(numeric.length, 6); j++) { const r = correlate(rows, numeric[i], numeric[j]); if (r !== null) correlations.push({ a: numeric[i], b: numeric[j], r }); }
    return ok({
      dataset, rows, columns: columnNames, meta,
      suggestions: [
        dateCol && numeric[0] ? { title: `${numeric[0]} trend over time`, why: `A date column (${dateCol}) and numeric metric (${numeric[0]}) exist, enabling monthly trends and period comparisons.`, data: timeSeries(rows, dateCol, numeric[0]), type: "area", metric: numeric[0] } : null,
        dims[0] && numeric[0] ? { title: `${numeric[0]} by ${dims[0]}`, why: `Segmentation by ${dims[0]} shows which groups drive ${numeric[0]}.`, data: groupBy(rows, dims[0], numeric[0]).slice(0, 10), type: "bar", metric: numeric[0] } : null,
        dims[1] && numeric[0] ? { title: `${numeric[0]} by ${dims[1]}`, why: `Compare ${numeric[0]} across ${dims[1]} to find concentration and gaps.`, data: groupBy(rows, dims[1], numeric[0]).slice(0, 10), type: "donut", metric: numeric[0] } : null,
      ].filter(Boolean),
      correlations, questions: generateQuestions(rows, meta), profiles: profileDataset(rows, meta),
    });
  }
  return ok({ dataset, rows, columns: columnNames, meta, issues, profiles: profileDataset(rows, meta), quality: qualityScore(rows, meta, issues), history, recipes: recs });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ready();
  const { id } = await params;
  const c = await ctx(id); if ((c as any).error) return (c as any).error;
  const { u, dataset, rows, columnNames, access } = c as any;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action !== "preview" && !canEdit(access.role)) return fail("Your workspace role is read-only (viewer).", 403);

  if (action === "preview" || action === "apply") {
    const result = applyOperation(rows, columnNames, String(body.op), body.params || {});
    if (action === "preview") return ok({ preview: { affectedRows: result.affectedRows, affectedCells: result.affectedCells, warnings: result.warnings, diffs: result.diffs, summary: result.summary } });
    const beforeMeta = inferColumns(rows); const before = qualityScore(rows, beforeMeta, detectIssues(rows, beforeMeta)).score;
    const { plan } = await planForWorkspace(access.workspace);
    const maxRows = Number(((plan?.limits as any) || {}).maxRowsPerDataset || 1000000);
    if (result.rows.length > maxRows) return fail("Result exceeds your plan's row limit.", 422);
    const [op] = await db.insert(cleaningOps).values({ datasetId: id, userId: u.id, operation: String(body.op), params: body.params || {}, affectedRows: result.affectedRows, affectedCells: result.affectedCells, beforeScore: before, snapshot: { rows, columns: columnNames } }).returning();
    const after = await saveDatasetRows(id, result.rows, result.columns);
    await db.update(cleaningOps).set({ afterScore: after }).where(eq(cleaningOps.id, op.id));
    await audit(u, "dataset.clean", "dataset", id, { op: body.op, affectedCells: result.affectedCells });
    const fresh = await loadDataset(id);
    return ok({ rows: fresh!.rows, columns: fresh!.columnNames, qualityScore: after, opId: op.id });
  }

  if (action === "revert") {
    const [op] = await db.select().from(cleaningOps).where(eq(cleaningOps.id, String(body.opId))).limit(1);
    if (!op || op.datasetId !== id || !op.snapshot) return fail("That operation has no snapshot to revert to.");
    const snap: any = op.snapshot;
    await saveDatasetRows(id, snap.rows, snap.columns);
    await db.update(cleaningOps).set({ status: "reverted" }).where(eq(cleaningOps.id, op.id));
    await audit(u, "dataset.revert", "dataset", id, { opId: op.id });
    const fresh = await loadDataset(id);
    return ok({ rows: fresh!.rows, columns: fresh!.columnNames });
  }

  if (action === "saveRecipe") {
    const hist = await db.select().from(cleaningOps).where(eq(cleaningOps.datasetId, id)).orderBy(desc(cleaningOps.createdAt)).limit(30);
    const steps = hist.filter((h) => h.status === "applied").reverse().map((h) => ({ op: h.operation, params: h.params }));
    if (!steps.length) return fail("Apply at least one cleaning operation before saving a recipe.");
    const [r] = await db.insert(recipes).values({ workspaceId: dataset.workspaceId, datasetId: id, name: String(body.name || "Cleaning recipe").slice(0, 120), steps, createdBy: u.id }).returning();
    return ok({ recipe: r });
  }
  if (action === "applyRecipe") {
    const [r] = await db.select().from(recipes).where(eq(recipes.id, String(body.recipeId))).limit(1);
    if (!r || r.workspaceId !== dataset.workspaceId) return fail("Recipe not found in this workspace.");
    let cur = rows; let cols = columnNames;
    for (const step of (r.steps as any[])) { const res = applyOperation(cur, cols, step.op, step.params || {}); cur = res.rows; cols = res.columns; }
    const beforeMeta = inferColumns(rows); const before = qualityScore(rows, beforeMeta, detectIssues(rows, beforeMeta)).score;
    await db.insert(cleaningOps).values({ datasetId: id, userId: u.id, operation: "recipe", params: { recipe: r.name, steps: (r.steps as any[]).length }, beforeScore: before, snapshot: { rows, columns: columnNames } });
    await saveDatasetRows(id, cur, cols);
    await audit(u, "dataset.recipe_applied", "dataset", id, { recipe: r.name });
    const fresh = await loadDataset(id);
    return ok({ rows: fresh!.rows, columns: fresh!.columnNames });
  }
  if (action === "rename") {
    await db.update(datasets).set({ name: String(body.name || dataset.name).slice(0, 140), description: String(body.description ?? dataset.description), updatedAt: new Date() }).where(eq(datasets.id, id));
    return ok({});
  }
  if (action === "duplicate") {
    const [nd] = await db.insert(datasets).values({ workspaceId: dataset.workspaceId, name: `${dataset.name} (copy)`, description: dataset.description, source: "duplicate", createdBy: u.id, tags: dataset.tags }).returning();
    await saveDatasetRows(nd.id, rows, columnNames);
    return ok({ dataset: nd });
  }
  if (action === "archive" || action === "activate") {
    await db.update(datasets).set({ status: action === "archive" ? "archived" : "active", updatedAt: new Date() }).where(eq(datasets.id, id));
    return ok({});
  }
  if (action === "delete") {
    await db.delete(datasets).where(eq(datasets.id, id));
    await audit(u, "dataset.delete", "dataset", id);
    return ok({});
  }
  if (action === "createDashboard") {
    const { dashboardFromTemplate } = await import("@/lib/dataEngine");
    const meta = inferColumns(rows);
    const [d] = await db.insert(dashboards).values({ workspaceId: dataset.workspaceId, datasetId: id, name: String(body.name || `${dataset.name} — dashboard`), config: { theme: "emerald", widgets: dashboardFromTemplate(String(body.template || "executive"), rows, meta) }, createdBy: u.id }).returning();
    await db.insert(jobs).values({ workspaceId: dataset.workspaceId, type: "dashboard", status: "completed", result: { dashboardId: d.id }, finishedAt: new Date() });
    return ok({ dashboard: d });
  }
  return fail("Unknown action.");
}
