// Deterministic data engine: profiling, issue detection, cleaning operations,
// analytics, question generation and grounded question answering.
// No LLM invents numbers — every figure below is computed from the rows.
export type Row = Record<string, string>;
export type ColType = "number" | "date" | "text" | "mixed";
export interface ColumnMeta { name: string; type: ColType; }

export const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/[$€£,%\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export function parseDate(v: unknown): Date | null {
  if (isEmpty(v)) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return validDate(+m[3], +m[1], +m[2]); // US M/D/Y
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return validDate(+m[3], +m[2], +m[1]); // EU D.M.Y
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return validDate(+m[3], +m[2], +m[1]);
  const d = new Date(s);
  return isNaN(+d) ? null : d;
}
function validDate(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
}
export const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function inferType(values: string[]): ColType {
  const vals = values.filter((v) => !isEmpty(v));
  if (!vals.length) return "text";
  const nNum = vals.filter((v) => toNumber(v) !== null).length;
  const nDate = vals.filter((v) => parseDate(v) !== null && toNumber(v) === null).length;
  if (nNum / vals.length >= 0.8) return nNum === vals.length ? "number" : "mixed";
  if (nDate / vals.length >= 0.8) return nDate === vals.length ? "date" : "mixed";
  if (nNum > 0 || nDate > 0) return "mixed";
  return "text";
}
export function inferColumns(rows: Row[]): ColumnMeta[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((name) => ({ name, type: inferType(rows.map((r) => r[name] ?? "")) }));
}
const quantile = (s: number[], q: number) => { if (!s.length) return 0; const pos = (s.length - 1) * q; const b = Math.floor(pos); const rest = pos - b; return s[b + 1] !== undefined ? s[b] + rest * (s[b + 1] - s[b]) : s[b]; };

export interface ColProfile {
  name: string; type: ColType; missing: number; missingPct: number; unique: number;
  min?: number; max?: number; mean?: number; median?: number; p25?: number; p75?: number;
  topValues?: { value: string; count: number }[]; dateMin?: string; dateMax?: string; quality: number;
}
export function profileDataset(rows: Row[], cols: ColumnMeta[]) {
  const profiles: ColProfile[] = cols.map((c) => {
    const vals = rows.map((r) => r[c.name] ?? "");
    const missing = vals.filter((v) => isEmpty(v)).length;
    const present = vals.filter((v) => !isEmpty(v));
    const unique = new Set(present.map((v) => v.trim())).size;
    const p: ColProfile = { name: c.name, type: c.type, missing, missingPct: rows.length ? Math.round((missing / rows.length) * 1000) / 10 : 0, unique, quality: 100 };
    if (c.type === "number" || c.type === "mixed") {
      const nums = present.map(toNumber).filter((n): n is number => n !== null).sort((a, b) => a - b);
      if (nums.length >= present.length * 0.5 && nums.length) {
        p.min = nums[0]; p.max = nums[nums.length - 1];
        p.mean = +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(3);
        p.median = quantile(nums, 0.5); p.p25 = quantile(nums, 0.25); p.p75 = quantile(nums, 0.75);
      }
    }
    if (c.type === "date" || c.type === "mixed") {
      const ds = present.map(parseDate).filter((d): d is Date => d !== null).sort((a, b) => +a - +b);
      if (ds.length >= present.length * 0.5 && ds.length) { p.dateMin = fmtDate(ds[0]); p.dateMax = fmtDate(ds[ds.length - 1]); }
    }
    const freq = new Map<string, number>();
    present.forEach((v) => freq.set(v.trim(), (freq.get(v.trim()) || 0) + 1));
    p.topValues = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([value, count]) => ({ value, count }));
    p.quality = Math.max(0, Math.round(100 - p.missingPct));
    return p;
  });
  return profiles;
}

export interface Issue {
  id: string; category: string; severity: "high" | "medium" | "low"; row?: number; column?: string;
  value?: string; problem: string; explanation: string; proposed?: string; confidence: "certain" | "likely" | "review";
  count: number; op?: string; opParams?: Record<string, unknown>;
}
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function detectIssues(rows: Row[], cols: ColumnMeta[]): Issue[] {
  const issues: Issue[] = [];
  let seq = 0; const id = () => `ISS-${String(++seq).padStart(3, "0")}`;
  // exact duplicates
  const seen = new Map<string, number>(); const dupRows: number[] = [];
  rows.forEach((r, i) => { const k = JSON.stringify(r); if (seen.has(k)) dupRows.push(i); else seen.set(k, i); });
  if (dupRows.length) issues.push({ id: id(), category: "Duplicate rows", severity: "high", row: dupRows[0] + 2, value: `rows ${dupRows.map((d) => d + 2).join(", ")}`, problem: `${dupRows.length} exact duplicate row(s)`, explanation: "Rows that are identical in every column usually come from a double export or re-import and inflate totals.", proposed: "Keep the first occurrence, remove the copies", confidence: "certain", count: dupRows.length, op: "dedupe", opParams: {} });
  // empty rows
  const emptyRows = rows.map((r, i) => Object.values(r).every(isEmpty) ? i : -1).filter((i) => i >= 0);
  if (emptyRows.length) issues.push({ id: id(), category: "Empty rows", severity: "medium", row: emptyRows[0] + 2, problem: `${emptyRows.length} fully empty row(s)`, explanation: "Blank rows carry no information and break some imports.", proposed: "Remove empty rows", confidence: "certain", count: emptyRows.length, op: "removeEmptyRows", opParams: {} });
  cols.forEach((c) => {
    const vals = rows.map((r) => r[c.name] ?? "");
    // missing
    const missIdx = vals.map((v, i) => isEmpty(v) ? i : -1).filter((i) => i >= 0);
    if (missIdx.length) issues.push({ id: id(), category: "Missing values", severity: missIdx.length > rows.length * 0.1 ? "high" : "medium", row: missIdx[0] + 2, column: c.name, value: "(empty)", problem: `${missIdx.length} missing value(s) in “${c.name}”`, explanation: `Empty cells at spreadsheet rows ${missIdx.slice(0, 8).map((i) => i + 2).join(", ")}${missIdx.length > 8 ? "…" : ""}. Aggregations will silently skip these records.`, proposed: "Review: fill, or remove the affected rows — never silently zero-fill", confidence: "certain", count: missIdx.length, op: "fillMissing", opParams: { column: c.name, strategy: c.type === "number" ? "median" : "mode" } });
    // whitespace
    const wsIdx = vals.map((v, i) => typeof v === "string" && v !== v.trim() && v.trim() !== "" ? i : -1).filter((i) => i >= 0);
    if (wsIdx.length) issues.push({ id: id(), category: "Whitespace", severity: "low", row: wsIdx[0] + 2, column: c.name, value: `“${vals[wsIdx[0]]}”`, problem: `${wsIdx.length} value(s) with leading/trailing spaces in “${c.name}”`, explanation: "Invisible spaces create phantom categories in grouping and break joins.", proposed: "Trim whitespace", confidence: "certain", count: wsIdx.length, op: "trim", opParams: { column: c.name } });
    // case inconsistency for text
    if (c.type === "text") {
      const groups = new Map<string, Set<string>>();
      vals.forEach((v) => { const t = (v || "").trim(); if (!t) return; const k = t.toLowerCase(); if (!groups.has(k)) groups.set(k, new Set()); groups.get(k)!.add(t); });
      const bad = [...groups.entries()].filter(([, s]) => s.size > 1);
      const affected = bad.reduce((acc, [k]) => acc + vals.filter((v) => (v || "").trim().toLowerCase() === k).length, 0);
      if (bad.length) issues.push({ id: id(), category: "Inconsistent labels", severity: "medium", column: c.name, value: bad.map(([, s]) => [...s].join(" / ")).slice(0, 3).join("; "), problem: `${bad.length} label(s) written with different capitalization in “${c.name}”`, explanation: "Variants such as different cases are treated as separate categories by group-by operations.", proposed: "Standardize to the most frequent spelling", confidence: "likely", count: affected, op: "standardizeCategories", opParams: { column: c.name } });
    }
    // numbers stored as text / invalid numbers
    const looksNumeric = (c.type === "number" || c.type === "mixed") && vals.some((v) => toNumber(v) !== null);
    if (looksNumeric) {
      const badIdx = vals.map((v, i) => !isEmpty(v) && toNumber(v) === null ? i : -1).filter((i) => i >= 0);
      const currencyIdx = vals.map((v, i) => !isEmpty(v) && toNumber(v) !== null && /[$€£,%]/.test(String(v)) ? i : -1).filter((i) => i >= 0);
      if (badIdx.length) issues.push({ id: id(), category: "Type mismatch", severity: "high", row: badIdx[0] + 2, column: c.name, value: String(vals[badIdx[0]]), problem: `${badIdx.length} non-numeric value(s) in numeric column “${c.name}”`, explanation: `Examples: ${badIdx.slice(0, 4).map((i) => `row ${i + 2} = “${vals[i]}”`).join(", ")}. These cells cannot be summed and are excluded from statistics.`, proposed: "Review each value — convert manually if the meaning is known", confidence: "review", count: badIdx.length });
      if (currencyIdx.length) issues.push({ id: id(), category: "Number formatting", severity: "medium", row: currencyIdx[0] + 2, column: c.name, value: String(vals[currencyIdx[0]]), problem: `${currencyIdx.length} number(s) stored as formatted text in “${c.name}”`, explanation: "Currency symbols and thousand separators make the cell a string, so spreadsheet formulas may skip it.", proposed: "Convert to plain numbers", confidence: "certain", count: currencyIdx.length, op: "toNumber", opParams: { column: c.name } });
      // outliers (IQR)
      const nums = vals.map((v, i) => ({ n: toNumber(v), i })).filter((x): x is { n: number; i: number } => x.n !== null);
      if (nums.length >= 12) {
        const sorted = nums.map((x) => x.n).sort((a, b) => a - b);
        const q1 = quantile(sorted, 0.25), q3 = quantile(sorted, 0.75), iqr = q3 - q1;
        if (iqr > 0) {
          const out = nums.filter((x) => x.n < q1 - 3 * iqr || x.n > q3 + 3 * iqr);
          if (out.length) issues.push({ id: id(), category: "Outlier candidates", severity: "low", row: out[0].i + 2, column: c.name, value: String(out[0].n), problem: `${out.length} extreme value(s) in “${c.name}” (beyond 3×IQR)`, explanation: `Values at rows ${out.slice(0, 5).map((o) => `${o.i + 2} (${o.n})`).join(", ")}. An outlier may be a genuine large order — review, do not auto-delete.`, proposed: "Review; optionally cap at the 3×IQR fence", confidence: "review", count: out.length, op: "capOutliers", opParams: { column: c.name } });
        }
      }
    }
    // dates
    const dateish = vals.some((v) => !isEmpty(v) && parseDate(v) !== null && toNumber(v) === null);
    if (dateish) {
      const badIdx = vals.map((v, i) => !isEmpty(v) && parseDate(v) === null ? i : -1).filter((i) => i >= 0);
      if (badIdx.length) issues.push({ id: id(), category: "Invalid dates", severity: "high", row: badIdx[0] + 2, column: c.name, value: String(vals[badIdx[0]]), problem: `${badIdx.length} unparseable date(s) in “${c.name}”`, explanation: `${badIdx.slice(0, 4).map((i) => `Row ${i + 2} → ${c.name} → “${vals[i]}”`).join("; ")}. These cannot be safely interpreted (e.g. month 13 or Feb 30), so no replacement is invented — fix at the source.`, proposed: "Manual review required", confidence: "review", count: badIdx.length });
      const formats = new Set<string>();
      vals.forEach((v) => { if (isEmpty(v)) return; const s = String(v); if (/^\d{4}-/.test(s)) formats.add("ISO"); else if (/^\d{1,2}\//.test(s)) formats.add("M/D/Y"); else if (/^\d{1,2}\./.test(s)) formats.add("D.M.Y"); });
      if (formats.size > 1) issues.push({ id: id(), category: "Mixed date formats", severity: "medium", column: c.name, value: [...formats].join(", "), problem: `Mixed date formats in “${c.name}”`, explanation: "Multiple formats in one column risk day/month swaps (03/04 could be March 4 or April 3).", proposed: "Standardize all valid dates to YYYY-MM-DD", confidence: "likely", count: vals.filter((v) => parseDate(v) !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(v).trim())).length, op: "standardizeDates", opParams: { column: c.name } });
    }
    // emails
    if (/email|e-mail|mail/i.test(c.name)) {
      const badIdx = vals.map((v, i) => !isEmpty(v) && !emailRe.test(String(v).trim()) ? i : -1).filter((i) => i >= 0);
      if (badIdx.length) issues.push({ id: id(), category: "Invalid emails", severity: "medium", row: badIdx[0] + 2, column: c.name, value: String(vals[badIdx[0]]), problem: `${badIdx.length} invalid email address(es) in “${c.name}”`, explanation: "Values do not match a standard email pattern and would bounce if mailed.", proposed: "Correct at source; no safe automatic fix", confidence: "likely", count: badIdx.length });
    }
  });
  const order = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
}

export function qualityScore(rows: Row[], cols: ColumnMeta[], issues: Issue[]): { score: number; formula: string } {
  const cells = Math.max(1, rows.length * cols.length);
  let penalties = 0;
  issues.forEach((i) => { const w = i.severity === "high" ? 3 : i.severity === "medium" ? 1.5 : 0.6; penalties += i.count * w; });
  const score = Math.max(0, Math.min(100, Math.round(100 - (penalties / cells) * 100)));
  return { score, formula: `Score = 100 − (weighted issue cells ÷ total cells × 100). High severity weighs 3×, medium 1.5×, low 0.6×. Deterministic — recomputed from the current rows every time.` };
}

/* ---------------- Cleaning operations ---------------- */
export interface OpResult { rows: Row[]; columns: string[]; affectedRows: number; affectedCells: number; warnings: string[]; diffs: { row: number; column: string; before: string; after: string }[]; summary: string; }
export function applyOperation(input: Row[], columns: string[], op: string, params: Record<string, any> = {}): OpResult {
  let rows = input.map((r) => ({ ...r }));
  let cols = [...columns];
  const diffs: OpResult["diffs"] = []; const warnings: string[] = [];
  let affectedCells = 0; const affectedRowSet = new Set<number>();
  const touch = (i: number, col: string, before: string, after: string) => { if (before !== after) { affectedCells++; affectedRowSet.add(i); if (diffs.length < 12) diffs.push({ row: i + 2, column: col, before: String(before ?? ""), after: String(after ?? "") }); } };
  const col = params.column as string;
  switch (op) {
    case "trim": rows.forEach((r, i) => (col ? [col] : cols).forEach((k) => { const b = r[k] ?? ""; const a = String(b).trim(); touch(i, k, b, a); r[k] = a; })); break;
    case "titleCase": case "lowerCase": case "upperCase":
      rows.forEach((r, i) => { const b = r[col] ?? ""; const a = op === "lowerCase" ? String(b).toLowerCase() : op === "upperCase" ? String(b).toUpperCase() : String(b).trim().toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()); touch(i, col, b, a); r[col] = a; }); break;
    case "standardizeCategories": {
      const freq = new Map<string, Map<string, number>>();
      rows.forEach((r) => { const t = String(r[col] ?? "").trim(); if (!t) return; const k = t.toLowerCase(); if (!freq.has(k)) freq.set(k, new Map()); freq.get(k)!.set(t, (freq.get(k)!.get(t) || 0) + 1); });
      const canon = new Map<string, string>(); freq.forEach((m, k) => canon.set(k, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]));
      rows.forEach((r, i) => { const b = r[col] ?? ""; const t = String(b).trim(); if (!t) return; const a = canon.get(t.toLowerCase()) || b; touch(i, col, b, a); r[col] = a; }); break;
    }
    case "standardizeDates": rows.forEach((r, i) => { const b = r[col] ?? ""; const d = parseDate(b); if (d) { const a = fmtDate(d); touch(i, col, b, a); r[col] = a; } else if (!isEmpty(b)) warnings.push(`Row ${i + 2}: “${b}” left unchanged (invalid date)`); }); break;
    case "toNumber": rows.forEach((r, i) => { const b = r[col] ?? ""; const n = toNumber(b); if (n !== null) { const a = String(n); touch(i, col, b, a); r[col] = a; } else if (!isEmpty(b)) warnings.push(`Row ${i + 2}: “${b}” is not a number — left unchanged`); }); break;
    case "dedupe": {
      const keys = (params.keys as string[])?.length ? (params.keys as string[]) : cols;
      const seen = new Set<string>(); const before = rows.length;
      rows = rows.filter((r, i) => { const k = keys.map((x) => String(r[x] ?? "").trim()).join("|"); if (seen.has(k)) { affectedRowSet.add(i); if (diffs.length < 12) diffs.push({ row: i + 2, column: keys.join(", "), before: "duplicate row", after: "(removed)" }); return false; } seen.add(k); return true; });
      affectedCells = (before - rows.length) * cols.length; break;
    }
    case "removeEmptyRows": { const before = rows.length; rows = rows.filter((r, i) => { const empty = Object.values(r).every(isEmpty); if (empty) affectedRowSet.add(i); return !empty; }); affectedCells = (before - rows.length) * cols.length; break; }
    case "fillMissing": {
      const strategy = params.strategy || "median";
      let fill = "";
      if (strategy === "value") fill = String(params.value ?? "");
      else if (strategy === "median" || strategy === "mean") { const nums = rows.map((r) => toNumber(r[col])).filter((n): n is number => n !== null).sort((a, b) => a - b); if (!nums.length) { warnings.push("No numeric values to compute a fill value from."); break; } fill = String(strategy === "median" ? quantile(nums, 0.5) : +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)); }
      else { const f = new Map<string, number>(); rows.forEach((r) => { const v = String(r[col] ?? "").trim(); if (v) f.set(v, (f.get(v) || 0) + 1); }); fill = [...f.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ""; }
      rows.forEach((r, i) => { if (isEmpty(r[col])) { touch(i, col, "", fill); r[col] = fill; } });
      warnings.push(`Filled with ${strategy}${strategy !== "value" ? ` (${fill})` : ""}. Treat imputed values as estimates in downstream analysis.`); break;
    }
    case "removeMissingRows": { const before = rows.length; const targets = col ? [col] : cols; rows = rows.filter((r, i) => { const bad = targets.some((k) => isEmpty(r[k])); if (bad) affectedRowSet.add(i); return !bad; }); affectedCells = (before - rows.length) * cols.length; break; }
    case "replace": rows.forEach((r, i) => { const b = r[col] ?? ""; const a = String(b).split(String(params.from ?? "")).join(String(params.to ?? "")); touch(i, col, b, a); r[col] = a; }); break;
    case "renameColumn": { const to = String(params.to || "").trim(); if (to && col && to !== col) { cols = cols.map((c) => c === col ? to : c); rows.forEach((r) => { r[to] = r[col]; delete r[col]; }); affectedCells = rows.length; diffs.push({ row: 1, column: col, before: col, after: to }); } break; }
    case "removeColumn": cols = cols.filter((c) => c !== col); rows.forEach((r) => delete r[col]); affectedCells = rows.length; break;
    case "splitColumn": {
      const sep = String(params.separator || " "); const names = [String(params.nameA || `${col} 1`), String(params.nameB || `${col} 2`)];
      const idx = cols.indexOf(col); cols.splice(idx, 1, names[0], names[1]);
      rows.forEach((r, i) => { const parts = String(r[col] ?? "").split(sep); r[names[0]] = (parts[0] || "").trim(); r[names[1]] = parts.slice(1).join(sep).trim(); delete r[col]; affectedRowSet.add(i); }); affectedCells = rows.length; break;
    }
    case "mergeColumns": {
      const a = String(params.columnA), b = String(params.columnB), nm = String(params.name || `${a} + ${b}`), sep = String(params.separator ?? " ");
      cols.push(nm); rows.forEach((r, i) => { r[nm] = [r[a], r[b]].filter((v) => !isEmpty(v)).join(sep); affectedRowSet.add(i); }); affectedCells = rows.length; break;
    }
    case "calculatedColumn": {
      const a = String(params.columnA), b = String(params.columnB), nm = String(params.name || "Calculated"), oper = String(params.operator || "*");
      if (!cols.includes(nm)) cols.push(nm);
      rows.forEach((r, i) => { const x = toNumber(r[a]), y = toNumber(r[b]); let v = ""; if (x !== null && y !== null) v = String(+(oper === "+" ? x + y : oper === "-" ? x - y : oper === "/" ? (y === 0 ? 0 : x / y) : x * y).toFixed(4)); else if (x !== null && params.constant !== undefined && params.constant !== "") { const y2 = Number(params.constant); v = String(+(oper === "+" ? x + y2 : oper === "-" ? x - y2 : oper === "/" ? x / y2 : x * y2).toFixed(4)); } r[nm] = v; affectedRowSet.add(i); }); affectedCells = rows.length; break;
    }
    case "capOutliers": {
      const nums = rows.map((r) => toNumber(r[col])).filter((n): n is number => n !== null).sort((a, b) => a - b);
      const q1 = quantile(nums, 0.25), q3 = quantile(nums, 0.75), iqr = q3 - q1; const lo = q1 - 3 * iqr, hi = q3 + 3 * iqr;
      rows.forEach((r, i) => { const n = toNumber(r[col]); if (n !== null && (n < lo || n > hi)) { const a = String(n < lo ? lo : hi); touch(i, col, r[col], a); r[col] = a; } });
      warnings.push(`Capped at the 3×IQR fence [${lo.toFixed(2)}, ${hi.toFixed(2)}]. Original values remain in the pre-operation snapshot.`); break;
    }
    case "removeRowsWhere": {
      const target = String(params.value ?? ""); const before = rows.length;
      rows = rows.filter((r, i) => { const v = String(r[col] ?? ""); const match = params.operator === "contains" ? v.toLowerCase().includes(target.toLowerCase()) : params.operator === ">" ? (toNumber(v) ?? -Infinity) > Number(target) : params.operator === "<" ? (toNumber(v) ?? Infinity) < Number(target) : v === target; if (match) affectedRowSet.add(i); return !match; });
      affectedCells = (before - rows.length) * cols.length; break;
    }
    default: warnings.push(`Unknown operation “${op}”.`);
  }
  return { rows, columns: cols, affectedRows: affectedRowSet.size, affectedCells, warnings, diffs, summary: describeOp(op, params) };
}
export function describeOp(op: string, p: Record<string, any> = {}): string {
  const names: Record<string, string> = { trim: "Trim whitespace", titleCase: "Title Case", lowerCase: "lowercase", upperCase: "UPPERCASE", standardizeCategories: "Standardize category labels", standardizeDates: "Standardize dates to YYYY-MM-DD", toNumber: "Convert to number", dedupe: "Remove duplicate rows", removeEmptyRows: "Remove empty rows", fillMissing: `Fill missing values (${p.strategy || "median"})`, removeMissingRows: "Remove rows with missing values", replace: `Replace “${p.from ?? ""}” → “${p.to ?? ""}”`, renameColumn: `Rename column → ${p.to ?? ""}`, removeColumn: "Remove column", splitColumn: "Split column", mergeColumns: "Merge columns", calculatedColumn: `Calculated column “${p.name ?? ""}”`, capOutliers: "Cap outliers (3×IQR)", removeRowsWhere: "Remove rows matching filter" };
  return `${names[op] || op}${p.column ? ` on “${p.column}”` : ""}`;
}

/* ---------------- Analytics ---------------- */
export function groupBy(rows: Row[], dim: string, metric: string, agg = "sum") {
  const m = new Map<string, number[]>(); const counts = new Map<string, number>();
  rows.forEach((r) => { const k = isEmpty(r[dim]) ? "(blank)" : String(r[dim]).trim(); counts.set(k, (counts.get(k) || 0) + 1); const n = toNumber(r[metric]); if (n !== null) { if (!m.has(k)) m.set(k, []); m.get(k)!.push(n); } });
  const keys = new Set([...counts.keys(), ...m.keys()]);
  return [...keys].map((k) => { const arr = m.get(k) || []; const val = agg === "count" ? (counts.get(k) || 0) : agg === "avg" ? (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0) : agg === "min" ? (arr.length ? Math.min(...arr) : 0) : agg === "max" ? (arr.length ? Math.max(...arr) : 0) : arr.reduce((a, b) => a + b, 0); return { label: k, value: +val.toFixed(2), count: counts.get(k) || 0 }; }).sort((a, b) => b.value - a.value);
}
export function timeSeries(rows: Row[], dateCol: string, metric: string, agg = "sum") {
  const m = new Map<string, number[]>(); const cnt = new Map<string, number>();
  rows.forEach((r) => { const d = parseDate(r[dateCol]); if (!d) return; const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; cnt.set(k, (cnt.get(k) || 0) + 1); const n = toNumber(r[metric]); if (n !== null) { if (!m.has(k)) m.set(k, []); m.get(k)!.push(n); } });
  return [...cnt.keys()].sort().map((k) => { const arr = m.get(k) || []; const v = agg === "count" ? (cnt.get(k) || 0) : agg === "avg" ? (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0) : arr.reduce((a, b) => a + b, 0); return { label: k, value: +v.toFixed(2), count: cnt.get(k) || 0 }; });
}
export function correlate(rows: Row[], a: string, b: string): number | null {
  const pairs = rows.map((r) => [toNumber(r[a]), toNumber(r[b])] as const).filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
  if (pairs.length < 4) return null;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length, my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let num = 0, dx = 0, dy = 0; pairs.forEach(([x, y]) => { num += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; });
  return dx && dy ? +(num / Math.sqrt(dx * dy)).toFixed(3) : null;
}
export const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
export const findCol = (cols: string[], ...keys: string[]) => cols.find((c) => keys.some((k) => c.toLowerCase().includes(k)));

export function generateQuestions(rows: Row[], cols: ColumnMeta[]): { question: string; category: string; requires: string[]; answerable: boolean }[] {
  const names = cols.map((c) => c.name);
  const rev = findCol(names, "revenue", "sales", "amount", "total"); const cost = findCol(names, "cost", "expense");
  const date = cols.find((c) => c.type === "date" || c.type === "mixed" && /date|month|created/i.test(c.name))?.name || findCol(names, "date");
  const prod = findCol(names, "product", "item"); const cat = findCol(names, "category", "segment"); const region = findCol(names, "region", "country", "city", "state");
  const cust = findCol(names, "customer", "client"); const qty = findCol(names, "quantity", "qty", "units");
  const out: { question: string; category: string; requires: string[]; answerable: boolean }[] = [];
  const add = (question: string, category: string, requires: (string | undefined)[]) => out.push({ question, category, requires: requires.filter(Boolean) as string[], answerable: requires.every(Boolean) });
  add(`What is total ${rev ? rev.toLowerCase() : "revenue"}?`, "Revenue", [rev]);
  add(`Which ${prod ? prod.toLowerCase() : "product"} generated the most revenue?`, "Products", [prod, rev]);
  add(`Which ${cat ? cat.toLowerCase() : "category"} contributes the most revenue?`, "Revenue", [cat, rev]);
  add(`Which ${region ? region.toLowerCase() : "region"} has the highest revenue?`, "Regions", [region, rev]);
  add("How has revenue trended month over month?", "Trends", [date, rev]);
  add("Compare the latest month with the previous month", "Trends", [date, rev]);
  add("What is the average order value?", "Revenue", [rev]);
  add("What is the overall profit margin?", "Profitability", [rev, cost]);
  add(`Who are the top 5 ${cust ? cust.toLowerCase() + "s" : "customers"} by revenue?`, "Customers", [cust, rev]);
  add(`Which ${cust ? cust.toLowerCase() + "s" : "customers"} have stopped purchasing recently?`, "Customers", [cust, date]);
  add(`What is total ${qty ? qty.toLowerCase() : "quantity"} sold?`, "Operations", [qty]);
  add("How many orders are there?", "Operations", [names[0]]);
  cols.filter((c) => c.type === "number").slice(0, 3).forEach((c) => add(`What is the distribution of ${c.name}?`, "Anomalies", [c.name]));
  return out;
}

export interface Answer {
  answer: string; numbers: { label: string; value: string }[]; table?: { label: string; value: number }[];
  chart?: { type: string; data: { label: string; value: number }[]; title: string };
  method: string; columns: string[]; period: string; assumptions: string[]; confidence: string;
  followups: string[]; actions: string[]; answerable: boolean;
}
export function answerQuestion(rows: Row[], cols: ColumnMeta[], qRaw: string): Answer {
  const q = qRaw.toLowerCase(); const names = cols.map((c) => c.name);
  const rev = findCol(names, "revenue", "sales", "amount", "total"); const cost = findCol(names, "cost", "expense");
  const date = findCol(names, "date", "month") || cols.find((c) => c.type === "date")?.name;
  const prod = findCol(names, "product", "item"); const cat = findCol(names, "category", "segment");
  const region = findCol(names, "region", "country", "city", "state"); const cust = findCol(names, "customer name", "customer", "client");
  const qty = findCol(names, "quantity", "qty", "units");
  const base: Answer = { answer: "", numbers: [], method: "", columns: [], period: "All rows in the current dataset version", assumptions: [], confidence: "High — computed deterministically from the rows shown; no values are estimated by a language model.", followups: [], actions: [], answerable: true };
  const money = (n: number) => fmtNum(n);
  const numColMention = cols.filter((c) => c.type === "number" || c.type === "mixed").find((c) => q.includes(c.name.toLowerCase()));
  const metric = rev || numColMention?.name;
  const invalidNote = "Rows whose values cannot be parsed as numbers/dates are excluded and reported in the Cleaning Studio.";

  if (/stopped|churn|inactive|haven'?t|no longer/.test(q) && cust && date) {
    const lastByCust = new Map<string, Date>(); let maxD = new Date(0), minD = new Date(8640000000000000);
    rows.forEach((r) => { const d = parseDate(r[date]); if (!d || isEmpty(r[cust])) return; if (d > maxD) maxD = d; if (d < minD) minD = d; const k = String(r[cust]).trim(); if (!lastByCust.has(k) || d > lastByCust.get(k)!) lastByCust.set(k, d); });
    const spanDays = Math.max(1, (+maxD - +minD) / 86400000); const cutoff = new Date(+maxD - spanDays * 0.4 * 86400000);
    const stopped = [...lastByCust.entries()].filter(([, d]) => d < cutoff).sort((a, b) => +a[1] - +b[1]);
    return { ...base, answer: `${stopped.length} of ${lastByCust.size} ${cust.toLowerCase()}s have no orders in the most recent 40% of the observed period (after ${fmtDate(cutoff)}).`, numbers: [{ label: "Customers tracked", value: String(lastByCust.size) }, { label: "Inactive since", value: fmtDate(cutoff) }, { label: "Inactive customers", value: String(stopped.length) }], table: stopped.slice(0, 10).map(([k, d]) => ({ label: `${k} (last: ${fmtDate(d)})`, value: Math.round((+maxD - +d) / 86400000) })), method: `MAX(${date}) per ${cust}; inactive = last order before the final 40% window of the dataset's date span. Table value = days since last order.`, columns: [cust, date], period: `${fmtDate(minD)} → ${fmtDate(maxD)}`, assumptions: ["“Stopped purchasing” is defined relative to the dataset window, not real-world churn.", invalidNote], followups: ["Which regions do inactive customers come from?", "What did inactive customers buy most?"], actions: ["Consider a win-back campaign for the listed customers (business judgment, not a computed fact)."] };
  }
  if (/margin|profitab|profit/.test(q) && metric && cost) {
    const pairs = rows.map((r) => [toNumber(r[metric]), toNumber(r[cost])] as const).filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
    const R = pairs.reduce((s, p) => s + p[0], 0), C = pairs.reduce((s, p) => s + p[1], 0);
    const margin = R ? ((R - C) / R) * 100 : 0;
    return { ...base, answer: `Overall gross margin is ${margin.toFixed(1)}%: revenue ${money(R)} minus cost ${money(C)} = gross profit ${money(R - C)} across ${pairs.length} rows with both values.`, numbers: [{ label: metric, value: money(R) }, { label: cost, value: money(C) }, { label: "Gross profit", value: money(R - C) }, { label: "Margin", value: `${margin.toFixed(1)}%` }], method: `SUM(${metric}) and SUM(${cost}) over rows where both parse as numbers; margin = (revenue − cost) ÷ revenue.`, columns: [metric, cost], assumptions: ["Gross margin only — operating expenses, tax and refunds are not in these columns unless the source already includes them."] , followups: ["Which category has the best margin?", "How has revenue trended month over month?"], actions: ["Review low-margin categories before discounting further."] };
  }
  if (/(compare|previous month|last month|growth|change)/.test(q) && date && metric) {
    const ts = timeSeries(rows, date, metric);
    if (ts.length >= 2) { const a = ts[ts.length - 2], b = ts[ts.length - 1]; const delta = a.value ? ((b.value - a.value) / a.value) * 100 : 0;
      return { ...base, answer: `${metric} moved from ${money(a.value)} in ${a.label} to ${money(b.value)} in ${b.label} — a change of ${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% (${money(b.value - a.value)}).`, numbers: [{ label: a.label, value: money(a.value) }, { label: b.label, value: money(b.value) }, { label: "Change", value: `${delta.toFixed(1)}%` }], table: ts, chart: { type: "line", data: ts, title: `${metric} by month` }, method: `Monthly SUM(${metric}) grouped by ${date}; compares the two most recent months present in the data. (b − a) ÷ a × 100.`, columns: [date, metric], period: `${ts[0].label} → ${ts[ts.length - 1].label}`, assumptions: ["Partial months are compared as-is; a short final month can look like a decline.", invalidNote], followups: ["Which category drove the change?", "Which region grew fastest?"], actions: [] };
    }
  }
  if (/trend|over time|monthly|month over month|timeline/.test(q) && date && metric) {
    const ts = timeSeries(rows, date, metric); const first = ts[0], last = ts[ts.length - 1];
    const delta = first && first.value ? ((last.value - first.value) / first.value) * 100 : 0;
    return { ...base, answer: `${metric} by month ranges from ${money(Math.min(...ts.map((t) => t.value)))} to ${money(Math.max(...ts.map((t) => t.value)))}. From ${first?.label} (${money(first?.value || 0)}) to ${last?.label} (${money(last?.value || 0)}) the change is ${delta.toFixed(1)}%.`, numbers: ts.slice(-3).map((t) => ({ label: t.label, value: money(t.value) })), table: ts, chart: { type: "area", data: ts, title: `${metric} by month` }, method: `Monthly SUM(${metric}) grouped by parsed ${date}.`, columns: [date, metric], period: `${first?.label} → ${last?.label}`, assumptions: [invalidNote], followups: ["Compare the latest month with the previous month", "Which region grew fastest?"], actions: [] };
  }
  const dimMatch = (re: RegExp, col?: string) => re.test(q) && col ? col : undefined;
  const dim = dimMatch(/product|item/, prod) || dimMatch(/categor|segment/, cat) || dimMatch(/region|countr|city|state/, region) || dimMatch(/customer|client|top/, cust) || dimMatch(/region/, region);
  if (dim && metric && /which|top|best|highest|most|by /.test(q)) {
    const g = groupBy(rows, dim, metric); const top = g[0]; const total = g.reduce((s, x) => s + x.value, 0);
    return { ...base, answer: `“${top.label}” leads ${dim} with ${money(top.value)} of ${metric} — ${total ? ((top.value / total) * 100).toFixed(1) : 0}% of the total ${money(total)} across ${g.length} groups.`, numbers: g.slice(0, 4).map((x) => ({ label: x.label, value: money(x.value) })), table: g.slice(0, 10), chart: { type: "bar", data: g.slice(0, 8), title: `${metric} by ${dim}` }, method: `SUM(${metric}) grouped by ${dim} (labels trimmed), sorted descending.`, columns: [dim, metric], assumptions: [invalidNote], followups: [`How has ${metric} trended month over month?`, "What is the overall profit margin?"], actions: [] };
  }
  if (/average|avg|mean|aov|order value/.test(q) && metric) {
    const nums = rows.map((r) => toNumber(r[metric])).filter((n): n is number => n !== null);
    const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    return { ...base, answer: `Average ${metric} per row is ${money(+avg.toFixed(2))} across ${nums.length} numeric rows (min ${money(Math.min(...nums))}, max ${money(Math.max(...nums))}).`, numbers: [{ label: `Average ${metric}`, value: money(+avg.toFixed(2)) }, { label: "Rows counted", value: String(nums.length) }, { label: `Total ${metric}`, value: money(+nums.reduce((a, b) => a + b, 0).toFixed(2)) }], method: `SUM(${metric}) ÷ COUNT(numeric ${metric}).`, columns: [metric], assumptions: [invalidNote], followups: [`What is total ${metric}?`, "How has revenue trended month over month?"], actions: [] };
  }
  if (/how many|count|orders|records|rows/.test(q)) {
    return { ...base, answer: `The current dataset version contains ${rows.length} data rows (excluding the header).`, numbers: [{ label: "Data rows", value: String(rows.length) }, { label: "Columns", value: String(names.length) }], method: "COUNT of rows in the current dataset version.", columns: names.slice(0, 4), followups: ["What is total revenue?", "Which product generated the most revenue?"], actions: [] };
  }
  if (/correlat|relationship/.test(q)) {
    const nums = cols.filter((c) => c.type === "number" || c.type === "mixed").map((c) => c.name).filter((n) => rows.some((r) => toNumber(r[n]) !== null));
    const mentioned = nums.filter((n) => q.includes(n.toLowerCase()));
    if (mentioned.length >= 2) { const r = correlate(rows, mentioned[0], mentioned[1]);
      return { ...base, answer: r === null ? "Not enough paired numeric values to compute a correlation." : `Pearson correlation between ${mentioned[0]} and ${mentioned[1]} is r = ${r} (${Math.abs(r) > 0.7 ? "strong" : Math.abs(r) > 0.4 ? "moderate" : "weak"} ${r >= 0 ? "positive" : "negative"} linear association).`, numbers: [{ label: "Pearson r", value: String(r ?? "n/a") }], method: `Pearson correlation over rows where both ${mentioned[0]} and ${mentioned[1]} parse as numbers.`, columns: mentioned, assumptions: ["Correlation does not establish causation."], followups: [], actions: [], answerable: r !== null };
    }
  }
  if (metric && /total|sum|revenue|sales/.test(q)) {
    const nums = rows.map((r) => toNumber(r[metric])).filter((n): n is number => n !== null);
    const total = nums.reduce((a, b) => a + b, 0);
    return { ...base, answer: `Total ${metric} is ${money(+total.toFixed(2))} across ${nums.length} of ${rows.length} rows with a parseable ${metric} value.`, numbers: [{ label: `Total ${metric}`, value: money(+total.toFixed(2)) }, { label: "Rows counted", value: String(nums.length) }], method: `SUM(${metric}) after stripping currency symbols/thousand separators.`, columns: [metric], assumptions: [invalidNote], followups: [`Which ${prod ? prod.toLowerCase() : "product"} generated the most revenue?`, "How has revenue trended month over month?"], actions: [] };
  }
  if (numColMention && /distribution|spread|range/.test(q)) {
    const nums = rows.map((r) => toNumber(r[numColMention.name])).filter((n): n is number => n !== null).sort((a, b) => a - b);
    return { ...base, answer: `${numColMention.name}: min ${money(nums[0] || 0)}, median ${money(quantile(nums, 0.5))}, mean ${money(+(nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length)).toFixed(2))}, max ${money(nums[nums.length - 1] || 0)} over ${nums.length} values.`, numbers: [{ label: "Min", value: money(nums[0] || 0) }, { label: "Median", value: money(quantile(nums, 0.5)) }, { label: "Max", value: money(nums[nums.length - 1] || 0) }], method: `Order statistics of numeric ${numColMention.name}.`, columns: [numColMention.name], followups: [], actions: [] };
  }
  return { ...base, answerable: false, answer: `I can't establish that from this dataset yet. I can answer questions about: ${generateQuestions(rows, cols).filter((x) => x.answerable).slice(0, 5).map((x) => `“${x.question}”`).join(", ")}. Try one of these, or clean/extend the dataset first.`, method: "No validated analytical plan matched the question and available columns.", columns: names, confidence: "Not answered — refusing is safer than inventing a number.", followups: generateQuestions(rows, cols).filter((x) => x.answerable).slice(0, 3).map((x) => x.question), actions: [] };
}

export function dashboardFromTemplate(template: string, rows: Row[], cols: ColumnMeta[]) {
  const names = cols.map((c) => c.name);
  const rev = findCol(names, "revenue", "sales", "amount", "total") || cols.find((c) => c.type === "number")?.name || names[0];
  const cost = findCol(names, "cost", "expense"); const date = findCol(names, "date") || cols.find((c) => c.type === "date")?.name;
  const cat = findCol(names, "category", "segment") || cols.find((c) => c.type === "text")?.name;
  const region = findCol(names, "region", "country", "city"); const prod = findCol(names, "product", "item");
  const status = findCol(names, "status");
  const w = (type: string, title: string, extra: any = {}, wdt = 6) => ({ id: Math.random().toString(36).slice(2, 9), type, title, metric: rev, dimension: cat || "", agg: "sum", width: wdt, color: "#059669", ...extra });
  const sets: Record<string, any[]> = {
    executive: [w("kpi", `Total ${rev}`, {}, 3), w("kpi", "Records", { agg: "count" }, 3), w("kpi", `Avg ${rev}`, { agg: "avg" }, 3), w("kpi", "Data quality", { agg: "quality" }, 3), w("area", `${rev} over time`, { time: true }, 8), w("donut", `${rev} by ${cat || "group"}`, {}, 4), w("bar", `${rev} by ${prod || cat || "group"}`, { dimension: prod || cat }, 6), w("bar", `${rev} by ${region || cat || "group"}`, { dimension: region || cat }, 6)],
    sales: [w("kpi", `Total ${rev}`, {}, 4), w("kpi", "Orders", { agg: "count" }, 4), w("kpi", `Avg ${rev}`, { agg: "avg" }, 4), w("line", `${rev} trend`, { time: true }, 12), w("bar", `Top ${prod || "products"}`, { dimension: prod || cat }, 6), w("donut", `Share by ${cat || "group"}`, {}, 6), w("table", `${rev} by ${region || cat || "group"}`, { dimension: region || cat }, 12)],
    finance: [w("kpi", `Total ${rev}`, {}, 4), w("kpi", `Total ${cost || "cost"}`, { metric: cost || rev }, 4), w("kpi", "Margin %", { agg: "margin", metric2: cost }, 4), w("area", `${rev} over time`, { time: true }, 6), w("bar", `${cost || "Cost"} by ${cat || "group"}`, { metric: cost || rev }, 6), w("table", `Profitability by ${cat || "group"}`, {}, 12)],
    ecommerce: [w("kpi", `Total ${rev}`, {}, 3), w("kpi", "Orders", { agg: "count" }, 3), w("kpi", `Avg order`, { agg: "avg" }, 3), w("kpi", "Quality", { agg: "quality" }, 3), w("bar", `Top ${prod || "products"}`, { dimension: prod || cat }, 6), w("funnel", `Orders by ${status || cat || "stage"}`, { dimension: status || cat, agg: "count" }, 6), w("area", "Revenue over time", { time: true }, 12)],
    operations: [w("kpi", "Records", { agg: "count" }, 4), w("kpi", `Total ${findCol(names, "quantity", "qty") || rev}`, { metric: findCol(names, "quantity", "qty") || rev }, 4), w("kpi", "Quality", { agg: "quality" }, 4), w("bar", `Records by ${status || cat || "group"}`, { dimension: status || cat, agg: "count" }, 6), w("histogram", `Distribution of ${rev}`, {}, 6), w("table", `Summary by ${region || cat || "group"}`, { dimension: region || cat }, 12)],
    blank: [],
  };
  return sets[template] || sets.executive;
}

export function computeWidget(widget: any, rows: Row[], cols: ColumnMeta[]): { value?: string; data?: { label: string; value: number }[] } {
  if (Array.isArray(widget.staticData) && widget.staticData.length) return { data: widget.staticData };
  const names = cols.map((c) => c.name);
  const metric = widget.metric || names.find((n) => rows.some((r) => toNumber(r[n]) !== null)) || names[0];
  if (widget.agg === "quality") { const iss = detectIssues(rows, cols); return { value: `${qualityScore(rows, cols, iss).score}/100` }; }
  if (widget.agg === "count" && widget.type === "kpi") return { value: fmtNum(rows.length) };
  if (widget.agg === "margin") { const rev = metric; const cost = widget.metric2 || findCol(names, "cost"); const pairs = rows.map((r) => [toNumber(r[rev]), cost ? toNumber(r[cost]) : null] as const).filter((p): p is [number, number] => p[0] !== null && p[1] !== null); const R = pairs.reduce((s, p) => s + p[0], 0), C = pairs.reduce((s, p) => s + p[1], 0); return { value: R ? `${(((R - C) / R) * 100).toFixed(1)}%` : "n/a" }; }
  if (widget.type === "kpi") { const nums = rows.map((r) => toNumber(r[metric])).filter((n): n is number => n !== null); const v = widget.agg === "avg" ? (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0) : widget.agg === "max" ? Math.max(0, ...nums) : widget.agg === "min" ? (nums.length ? Math.min(...nums) : 0) : nums.reduce((a, b) => a + b, 0); return { value: fmtNum(+v.toFixed(2)) }; }
  const date = findCol(names, "date") || cols.find((c) => c.type === "date")?.name;
  if (widget.time && date) return { data: timeSeries(rows, date, metric, widget.agg || "sum") };
  if (widget.type === "histogram") { const nums = rows.map((r) => toNumber(r[metric])).filter((n): n is number => n !== null).sort((a, b) => a - b); if (!nums.length) return { data: [] }; const min = nums[0], max = nums[nums.length - 1], bins = 8, step = (max - min) / bins || 1; const data = Array.from({ length: bins }, (_, i) => ({ label: `${fmtNum(+(min + i * step).toFixed(0))}`, value: 0 })); nums.forEach((n) => { const idx = Math.min(bins - 1, Math.floor((n - min) / step)); data[idx].value++; }); return { data }; }
  if (widget.type === "scatter") { const y = widget.metric2 || metric; return { data: rows.map((r) => ({ label: String(toNumber(r[widget.dimension || metric]) ?? 0), value: toNumber(r[y]) ?? 0 })).filter((d) => d.value !== 0).slice(0, 200) }; }
  const dim = widget.dimension || cols.find((c) => c.type === "text")?.name || names[0];
  return { data: groupBy(rows, dim, metric, widget.agg || "sum").slice(0, widget.type === "table" ? 25 : 10) };
}
