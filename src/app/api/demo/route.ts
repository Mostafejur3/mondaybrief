import { ok, fail, ready, getSetting } from "@/lib/server";
import { generateDemoRows, DEMO_COLUMNS, DEMO_EXPECTED } from "@/lib/demoData";
import { inferColumns, detectIssues, qualityScore, profileDataset, applyOperation, answerQuestion, generateQuestions, dashboardFromTemplate, type Row } from "@/lib/dataEngine";

// Public demo API. Stateless: demo edits live only in the visitor's session (client state),
// never touching production workspaces. The 100-row policy is enforced HERE, server-side.
function checkRows(rows: any, limit: number): Row[] | null {
  if (!Array.isArray(rows)) return null;
  if (rows.length > limit) return null;
  return rows.map((r) => { const o: Row = {}; for (const [k, v] of Object.entries(r || {})) o[String(k).slice(0, 80)] = v === null || v === undefined ? "" : String(v).slice(0, 2000); return o; });
}

export async function GET() {
  await ready();
  const app = await getSetting("app", {});
  const limit = Number(app.demoRowLimit ?? 100);
  if (limit === 0) return fail("The public demo is currently disabled by the administrator.", 403);
  const rows = generateDemoRows();
  const meta = inferColumns(rows);
  const issues = detectIssues(rows, meta);
  return ok({
    rows, columns: DEMO_COLUMNS, rowLimit: limit, rowCount: rows.length,
    quality: qualityScore(rows, meta, issues), issues, profiles: profileDataset(rows, meta),
    questions: generateQuestions(rows, meta), widgets: dashboardFromTemplate("sales", rows, meta),
    expected: DEMO_EXPECTED, isDemo: true,
  });
}

export async function POST(req: Request) {
  await ready();
  const body = await req.json().catch(() => ({}));
  const app = await getSetting("app", {});
  const limit = Number(app.demoRowLimit ?? 100);
  if (body.action === "reset") return GET();

  if (body.action === "upload") {
    // Demo uploads are capped server-side; we reject instead of silently truncating.
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (rows.length > limit) return fail(`Demo policy: datasets are limited to ${limit} data rows. Your file has ${rows.length} rows — nothing was imported and nothing was silently truncated. Create a free account to process larger files (Free plan: up to 1,000 rows per dataset).`, 422, { code: "DEMO_ROW_LIMIT", limit, received: rows.length });
    const clean = checkRows(rows, limit); if (!clean || !clean.length) return fail("No rows found in the uploaded file.");
    const columns = Object.keys(clean[0]);
    const meta = inferColumns(clean); const issues = detectIssues(clean, meta);
    return ok({ rows: clean, columns, rowCount: clean.length, rowLimit: limit, quality: qualityScore(clean, meta, issues), issues, profiles: profileDataset(clean, meta), questions: generateQuestions(clean, meta), widgets: dashboardFromTemplate("executive", clean, meta), isDemo: true, uploaded: true });
  }

  const rows = checkRows(body.rows, limit);
  if (!rows) return fail(`Demo policy: processing is limited to ${limit} data rows server-side. Register for higher limits.`, 422, { code: "DEMO_ROW_LIMIT" });
  const columns: string[] = Array.isArray(body.columns) && body.columns.length ? body.columns.map(String) : Object.keys(rows[0] || {});
  const meta = inferColumns(rows);

  if (body.action === "clean") {
    const result = applyOperation(rows, columns, String(body.op), body.params || {});
    if (result.rows.length > limit) return fail("That operation would exceed the demo row limit.", 422);
    const m2 = inferColumns(result.rows); const iss = detectIssues(result.rows, m2);
    return ok({ rows: result.rows, columns: result.columns, affectedRows: result.affectedRows, affectedCells: result.affectedCells, warnings: result.warnings, quality: qualityScore(result.rows, m2, iss), issues: iss });
  }
  if (body.action === "profile") { const iss = detectIssues(rows, meta); return ok({ profiles: profileDataset(rows, meta), issues: iss, quality: qualityScore(rows, meta, iss) }); }
  if (body.action === "ask") {
    const answer = answerQuestion(rows, meta, String(body.question || ""));
    return ok({ answer, label: "Demo result — computed from the fictional sample dataset." });
  }
  if (body.action === "questions") return ok({ questions: generateQuestions(rows, meta) });
  return fail("Unknown demo action.");
}
