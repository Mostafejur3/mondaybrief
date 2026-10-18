"use client";
import { useMemo, useState } from "react";
import { Modal, useToast, sevBadge } from "./ui";
import { applyOperation, detectIssues, inferColumns, isEmpty, parseDate, profileDataset, qualityScore, toNumber, describeOp, type Row } from "@/lib/dataEngine";
import { AlertTriangle, CheckCircle2, Eye, History, ListChecks, Search, Sparkles, Table2, Wand2, X } from "lucide-react";

type ApplyFn = (op: string, params: Record<string, any>) => Promise<void>;

export function Studio({ rows, columns, onApply, history = [], onRevert, busy }: {
  rows: Row[]; columns: string[]; onApply: ApplyFn; history?: any[]; onRevert?: (opId: string) => void; busy?: boolean;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"preview" | "issues" | "clean" | "profile" | "history">("preview");
  const [search, setSearch] = useState(""); const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState(""); const [sortDir, setSortDir] = useState(1);
  const [selectedCol, setSelectedCol] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ op: string; params: any; result: any } | null>(null);
  const [aiText, setAiText] = useState("");
  const meta = useMemo(() => inferColumns(rows), [rows]);
  const issues = useMemo(() => detectIssues(rows, meta), [rows, meta]);
  const profiles = useMemo(() => profileDataset(rows, meta), [rows, meta]);
  const q = useMemo(() => qualityScore(rows, meta, issues), [rows, meta, issues]);
  const per = 25;

  const filtered = useMemo(() => {
    let r = rows.map((row, i) => ({ row, i }));
    if (search) { const s = search.toLowerCase(); r = r.filter(({ row }) => Object.values(row).some((v) => String(v).toLowerCase().includes(s))); }
    if (sortCol) r.sort((a, b) => { const x = a.row[sortCol] ?? "", y = b.row[sortCol] ?? ""; const nx = toNumber(x), ny = toNumber(y); return (nx !== null && ny !== null ? nx - ny : String(x).localeCompare(String(y))) * sortDir; });
    return r;
  }, [rows, search, sortCol, sortDir]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / per));
  const pageRows = filtered.slice(page * per, (page + 1) * per);

  const cellBad = (col: string, v: string) => {
    if (isEmpty(v)) return "bg-amber-50 dark:bg-amber-950/40";
    const m = meta.find((x) => x.name === col);
    if (m && (m.type === "date" || /date/i.test(col)) && parseDate(v) === null && toNumber(v) === null && /\d/.test(String(v))) return "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold";
    if (m && (m.type === "number" || m.type === "mixed") && toNumber(v) === null && rows.some((r) => toNumber(r[col]) !== null)) return "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300";
    if (/email/i.test(col) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim())) return "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300";
    return "";
  };

  const openPreview = (op: string, params: any) => setPreview({ op, params, result: applyOperation(rows, columns, op, params) });
  const confirmApply = async () => {
    if (!preview) return;
    try { await onApply(preview.op, preview.params); toast(`${describeOp(preview.op, preview.params)} applied`); setPreview(null); }
    catch (e: any) { toast(e.message, "error"); }
  };

  const aiPlan = () => {
    // Deterministic plan derived from detected issues — nothing executes without approval.
    const actionable = issues.filter((i) => i.op && !dismissed.has(i.id));
    if (!actionable.length) { toast("No safely auto-fixable issues found. Remaining items need manual review.", "info"); return; }
    setPreview({ op: "__plan__", params: { steps: actionable.map((i) => ({ op: i.op!, params: i.opParams || {} })) }, result: null });
  };
  const applyPlan = async () => {
    if (!preview) return;
    for (const s of preview.params.steps) { try { await onApply(s.op, s.params); } catch (e: any) { toast(e.message, "error"); return; } }
    toast("Cleaning plan applied step by step"); setPreview(null);
  };

  const tabs = [
    ["preview", Table2, `Preview (${rows.length} rows)`], ["issues", AlertTriangle, `Issues (${issues.filter((i) => !dismissed.has(i.id)).length})`],
    ["clean", Wand2, "Cleaning operations"], ["profile", ListChecks, "Column profiles"], ["history", History, `History (${history.length})`],
  ] as const;

  return (
    <div>
      <div className="card p-3.5 mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-[52px] h-[52px]">
            <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90"><circle cx="26" cy="26" r="22" fill="none" stroke="var(--surface2)" strokeWidth="6" /><circle cx="26" cy="26" r="22" fill="none" stroke={q.score >= 90 ? "#059669" : q.score >= 70 ? "#d97706" : "#dc2626"} strokeWidth="6" strokeDasharray={`${(q.score / 100) * 138} 138`} strokeLinecap="round" /></svg>
            <span className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold">{q.score}</span>
          </div>
          <div><p className="font-bold text-[14px]">Data quality score</p><p className="muted text-[11.5px] max-w-[420px]">{q.formula}</p></div>
        </div>
        <div className="flex gap-2 flex-wrap ml-auto">
          <span className="badge b-red">{issues.filter((i) => i.severity === "high").length} high</span>
          <span className="badge b-amber">{issues.filter((i) => i.severity === "medium").length} medium</span>
          <span className="badge b-slate">{issues.filter((i) => i.severity === "low").length} low</span>
          <span className="badge b-blue">{columns.length} columns</span>
        </div>
      </div>

      <div className="card p-3.5 mb-3">
        <p className="font-bold text-[13.5px] flex items-center gap-1.5"><Sparkles size={15} className="text-emerald-600" /> AI Cleaning Assistant <span className="badge b-emerald">proposes — never auto-executes</span></p>
        <div className="flex flex-wrap gap-2 mt-2">
          <input className="input flex-1 min-w-[220px]" placeholder="Ask e.g. “Clean this dataset”, “Standardize all date formats”, “Find duplicates”…" value={aiText} onChange={(e) => setAiText(e.target.value)} aria-label="AI cleaning request" />
          <button className="btn btn-primary" disabled={busy} onClick={() => {
            const t = aiText.toLowerCase();
            if (/date/.test(t)) { const dc = meta.find((m) => m.type === "date" || /date/i.test(m.name))?.name; dc ? openPreview("standardizeDates", { column: dc }) : toast("No date column detected.", "info"); }
            else if (/duplicat/.test(t)) openPreview("dedupe", {});
            else if (/missing|empty|null/.test(t)) { setTab("issues"); toast("Missing-value issues are listed with safe options. We never silently zero-fill.", "info"); }
            else if (/explain|quality|problem/.test(t)) setTab("issues");
            else aiPlan();
          }}>Generate cleaning plan</button>
          <button className="btn btn-ghost" disabled={busy} onClick={aiPlan}>Fix all safe issues (review first)</button>
        </div>
        <p className="muted text-[11.5px] mt-2">The assistant maps your request to a controlled list of validated operations, shows exact before/after effects, and waits for your approval. Content inside uploaded cells is treated as untrusted data, never as instructions.</p>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-3">
        {tabs.map(([id, Icon, label]) => <button key={id} onClick={() => setTab(id as any)} className={`btn btn-sm ${tab === id ? "btn-primary" : "btn-ghost"}`}><Icon size={14} />{label}</button>)}
      </div>

      {tab === "preview" && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="relative"><Search size={14} className="absolute left-2.5 top-[9px] muted" /><input className="input pl-8 w-[220px]" placeholder="Search all cells…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} aria-label="Search rows" /></div>
            <span className="text-[12px] muted">{filtered.length.toLocaleString()} of {rows.length.toLocaleString()} rows · click a header to sort · amber = missing, red = invalid</span>
            <div className="ml-auto flex items-center gap-1.5 text-[12px]">
              <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>‹ Prev</button>
              <span>Page {page + 1} / {pageCount}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>Next ›</button>
            </div>
          </div>
          <div className="overflow-auto max-h-[460px]">
            <table className="data">
              <thead><tr><th>#</th>{columns.map((c) => {
                const m = meta.find((x) => x.name === c);
                return <th key={c} onClick={() => { if (sortCol === c) setSortDir(-sortDir); else { setSortCol(c); setSortDir(1); } setSelectedCol(c); }} className="cursor-pointer select-none" title="Click to sort / select">
                  {c} <span className="normal-case font-normal opacity-70">{m?.type}{sortCol === c ? (sortDir > 0 ? " ▲" : " ▼") : ""}</span></th>;
              })}</tr></thead>
              <tbody>{pageRows.map(({ row, i }) => (
                <tr key={i}><td className="muted">{i + 2}</td>{columns.map((c) => <td key={c} className={`${cellBad(c, row[c] ?? "")} ${selectedCol === c ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`} title={String(row[c] ?? "")}>{isEmpty(row[c]) ? <span className="muted italic">∅</span> : String(row[c])}</td>)}</tr>
              ))}</tbody>
            </table>
            {pageRows.length === 0 && <p className="p-6 text-center muted text-[13px]">No rows match the current search.</p>}
          </div>
          {selectedCol && (() => { const p = profiles.find((x) => x.name === selectedCol); return p ? (
            <div className="p-3 border-t text-[12.5px] flex flex-wrap gap-x-5 gap-y-1" style={{ borderColor: "var(--border)" }}>
              <b>{p.name}</b><span>Type: {p.type}</span><span>Unique: {p.unique}</span><span>Missing: {p.missing} ({p.missingPct}%)</span>
              {p.min !== undefined && <span>Min {p.min} · Median {p.median} · Mean {p.mean} · Max {p.max}</span>}
              {p.dateMin && <span>Dates: {p.dateMin} → {p.dateMax}</span>}
              {p.topValues && <span>Top: {p.topValues.slice(0, 3).map((t) => `${t.value} (${t.count})`).join(", ")}</span>}
            </div>) : null; })()}
        </div>
      )}

      {tab === "issues" && (
        <div className="space-y-2.5">
          {issues.filter((i) => !dismissed.has(i.id)).length === 0 && <div className="card p-6 text-center"><CheckCircle2 className="mx-auto text-emerald-600 mb-2" size={26} /><b>No open issues.</b><p className="muted text-[13px]">All deterministic checks pass on the current rows (dismissed items excluded).</p></div>}
          {issues.filter((i) => !dismissed.has(i.id)).map((i) => (
            <div key={i.id} className="card p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${sevBadge(i.severity)}`}>{i.severity}</span>
                <b className="text-[13.5px]">{i.problem}</b>
                <span className="badge b-slate">{i.category}</span>
                <span className="text-[11.5px] muted">{i.id}{i.row ? ` · first at row ${i.row}` : ""}{i.column ? ` · column “${i.column}”` : ""}{i.value ? ` · value: ${i.value}` : ""}</span>
                <span className="badge b-blue ml-auto">{i.confidence === "certain" ? "Certain" : i.confidence === "likely" ? "Likely" : "Needs review"}</span>
              </div>
              <p className="muted text-[12.5px] mt-1.5">{i.explanation}</p>
              <p className="text-[12.5px] mt-1"><b>Proposed:</b> {i.proposed} · <b>Affected:</b> {i.count} record(s)</p>
              <div className="flex gap-2 mt-2.5">
                {i.op
                  ? <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => openPreview(i.op!, i.opParams || {})}><Eye size={13} /> Preview fix</button>
                  : <span className="badge b-amber">Manual review — no safe automatic fix</span>}
                <button className="btn btn-ghost btn-sm" onClick={() => setDismissed(new Set([...dismissed, i.id]))}><X size={13} /> Dismiss</button>
              </div>
            </div>
          ))}
          {dismissed.size > 0 && <button className="link text-[12.5px]" onClick={() => setDismissed(new Set())}>Restore {dismissed.size} dismissed issue(s)</button>}
        </div>
      )}

      {tab === "clean" && <OpsPanel columns={columns} onPreview={openPreview} busy={busy} />}
      {tab === "profile" && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {profiles.map((p) => (
            <div key={p.name} className="card p-3.5">
              <div className="flex items-center gap-2"><b className="text-[13.5px]">{p.name}</b><span className="badge b-slate">{p.type}</span><span className="badge b-emerald ml-auto">quality {p.quality}</span></div>
              <div className="text-[12px] muted mt-2 space-y-0.5">
                <p>Missing: {p.missing} ({p.missingPct}%) · Unique: {p.unique}</p>
                {p.min !== undefined && <p>Min {p.min} · P25 {Math.round((p.p25 || 0) * 100) / 100} · Median {p.median} · Mean {p.mean} · P75 {Math.round((p.p75 || 0) * 100) / 100} · Max {p.max}</p>}
                {p.dateMin && <p>Date range: {p.dateMin} → {p.dateMax}</p>}
                {p.topValues && <p>Frequent: {p.topValues.slice(0, 4).map((t) => `${t.value} (${t.count})`).join(" · ")}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "history" && (
        <div className="card overflow-hidden">
          {history.length === 0 ? <p className="p-5 muted text-[13px]">No transformations yet. Applied operations appear here with before/after scores and can be reverted (the original upload is preserved as the first snapshot).</p> : (
            <table className="data"><thead><tr><th>When</th><th>Operation</th><th>Affected</th><th>Quality</th><th>Status</th><th></th></tr></thead>
              <tbody>{history.map((h) => (
                <tr key={h.id}><td>{new Date(h.createdAt).toLocaleString()}</td><td>{describeOp(h.operation, h.params || {})}</td>
                  <td>{h.affectedRows} rows · {h.affectedCells} cells</td><td>{h.beforeScore} → {h.afterScore}</td>
                  <td><span className={`badge ${h.status === "applied" ? "b-emerald" : "b-slate"}`}>{h.status}</span></td>
                  <td>{h.status === "applied" && onRevert && <button className="btn btn-ghost btn-sm" onClick={() => onRevert(h.id)}>Revert to before</button>}</td></tr>
              ))}</tbody></table>
          )}
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.op === "__plan__" ? "Review cleaning plan" : "Preview transformation — before vs after"} wide>
        {preview?.op === "__plan__" ? (
          <div>
            <p className="text-[13px] muted mb-3">These are the safely auto-fixable items detected in the current rows. They run sequentially; each step is logged and reversible. Items needing human judgment (invalid dates, type mismatches, outliers) are excluded.</p>
            <ol className="space-y-1.5 text-[13px] list-decimal ml-5">{preview.params.steps.map((s: any, i: number) => <li key={i}>{describeOp(s.op, s.params)}</li>)}</ol>
            <div className="flex justify-end gap-2 mt-5"><button className="btn btn-ghost" onClick={() => setPreview(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={applyPlan}>Approve & apply plan</button></div>
          </div>
        ) : preview && (
          <div>
            <p className="text-[13.5px]"><b>{describeOp(preview.op, preview.params)}</b></p>
            <p className="muted text-[12.5px] mt-1">Would change <b>{preview.result.affectedCells}</b> cell(s) across <b>{preview.result.affectedRows}</b> row(s). Nothing is saved until you confirm. A snapshot of the current data is kept so you can revert.</p>
            {preview.result.warnings?.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-[12.5px] p-3">{preview.result.warnings.slice(0, 6).map((w: string, i: number) => <p key={i}>• {w}</p>)}</div>}
            {preview.result.diffs?.length > 0 && (
              <div className="overflow-auto max-h-[300px] mt-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
                <table className="data"><thead><tr><th>Row</th><th>Column</th><th>Before</th><th>After</th></tr></thead>
                  <tbody>{preview.result.diffs.map((d: any, i: number) => <tr key={i}><td>{d.row}</td><td>{d.column}</td><td className="text-red-700 dark:text-red-300">{d.before === "" ? "(empty)" : d.before}</td><td className="text-emerald-700 dark:text-emerald-300 font-semibold">{d.after}</td></tr>)}</tbody></table>
              </div>
            )}
            {preview.result.affectedCells === 0 && <p className="muted text-[13px] mt-3">This operation would not change any cell in the current data.</p>}
            <div className="flex justify-end gap-2 mt-5"><button className="btn btn-ghost" onClick={() => setPreview(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={confirmApply}>Apply transformation</button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function OpsPanel({ columns, onPreview, busy }: { columns: string[]; onPreview: (op: string, p: any) => void; busy?: boolean }) {
  const [col, setCol] = useState(columns[0] || "");
  const [colB, setColB] = useState(columns[1] || "");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [fillStrategy, setFillStrategy] = useState("median"); const [fillValue, setFillValue] = useState("");
  const [newName, setNewName] = useState(""); const [sep, setSep] = useState(" ");
  const [calcName, setCalcName] = useState("Calculated"); const [oper, setOper] = useState("*");
  const [filterOp, setFilterOp] = useState("equals"); const [filterVal, setFilterVal] = useState("");
  const colSel = (v: string, set: (s: string) => void) => (<select className="select" value={v} onChange={(e) => set(e.target.value)}>{columns.map((c) => <option key={c}>{c}</option>)}</select>);
  const Block = ({ title, children, go, label = "Preview" }: any) => (
    <div className="card p-3.5"><p className="font-bold text-[13px] mb-2">{title}</p><div className="space-y-2">{children}<button className="btn btn-primary btn-sm" disabled={busy} onClick={go}>{label}</button></div></div>
  );
  return (
    <div>
      <div className="card p-3 mb-3 flex flex-wrap items-center gap-2"><label className="lbl !mb-0">Target column</label><div className="w-[220px]">{colSel(col, setCol)}</div><span className="muted text-[12px]">Every operation shows a before/after preview before it is applied.</span></div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <Block title="Whitespace & case" go={() => onPreview("trim", { column: col })} label="Trim whitespace">
          <div className="flex gap-1.5 flex-wrap">
            <button className="btn btn-ghost btn-sm" onClick={() => onPreview("titleCase", { column: col })}>Title Case</button>
            <button className="btn btn-ghost btn-sm" onClick={() => onPreview("lowerCase", { column: col })}>lowercase</button>
            <button className="btn btn-ghost btn-sm" onClick={() => onPreview("upperCase", { column: col })}>UPPERCASE</button>
            <button className="btn btn-ghost btn-sm" onClick={() => onPreview("standardizeCategories", { column: col })}>Normalize labels</button>
          </div></Block>
        <Block title="Duplicates & empty rows" go={() => onPreview("dedupe", {})} label="Remove exact duplicates">
          <button className="btn btn-ghost btn-sm" onClick={() => onPreview("removeEmptyRows", {})}>Remove fully-empty rows</button>
          <p className="muted text-[11.5px]">Dedupe compares all columns. Similar-but-not-identical records are left for review.</p></Block>
        <Block title="Convert types" go={() => onPreview("standardizeDates", { column: col })} label="Standardize dates → YYYY-MM-DD">
          <button className="btn btn-ghost btn-sm" onClick={() => onPreview("toNumber", { column: col })}>Convert to number (strip $ , %)</button>
          <p className="muted text-[11.5px]">Unparseable values are reported, never silently replaced.</p></Block>
        <Block title="Missing values" go={() => onPreview("fillMissing", { column: col, strategy: fillStrategy, value: fillValue })} label="Preview fill">
          <select className="select" value={fillStrategy} onChange={(e) => setFillStrategy(e.target.value)}>
            <option value="median">Median (numeric)</option><option value="mean">Mean (numeric)</option>
            <option value="mode">Most frequent value</option><option value="value">Fixed value below</option></select>
          {fillStrategy === "value" && <input className="input" placeholder="Replacement value" value={fillValue} onChange={(e) => setFillValue(e.target.value)} />}
          <button className="btn btn-ghost btn-sm" onClick={() => onPreview("removeMissingRows", { column: col })}>Or remove rows missing this column</button>
          <p className="muted text-[11.5px]">Imputed values are estimates — the audit log records the method used.</p></Block>
        <Block title="Find & replace" go={() => onPreview("replace", { column: col, from, to })}>
          <input className="input" placeholder="Find" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input className="input" placeholder="Replace with" value={to} onChange={(e) => setTo(e.target.value)} /></Block>
        <Block title="Rename / remove column" go={() => onPreview("renameColumn", { column: col, to: newName })} label="Rename">
          <input className="input" placeholder="New column name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn btn-danger btn-sm" onClick={() => onPreview("removeColumn", { column: col })}>Remove column “{col}”</button></Block>
        <Block title="Split / merge columns" go={() => onPreview("splitColumn", { column: col, separator: sep, nameA: `${col} (part 1)`, nameB: `${col} (part 2)` })} label="Split target column">
          <input className="input" placeholder="Separator (space, comma…)" value={sep} onChange={(e) => setSep(e.target.value)} />
          {colSel(colB, setColB)}
          <button className="btn btn-ghost btn-sm" onClick={() => onPreview("mergeColumns", { columnA: col, columnB: colB, name: `${col} + ${colB}`, separator: sep })}>Merge target + selected</button></Block>
        <Block title="Calculated column" go={() => onPreview("calculatedColumn", { columnA: col, columnB: colB, operator: oper, name: calcName })} label="Preview calculation">
          <div className="flex gap-1.5"><span className="flex-1">{colSel(colB, setColB)}</span>
            <select className="select !w-[64px]" value={oper} onChange={(e) => setOper(e.target.value)}>{["+", "-", "*", "/"].map((o) => <option key={o}>{o}</option>)}</select></div>
          <input className="input" placeholder="New column name" value={calcName} onChange={(e) => setCalcName(e.target.value)} />
          <p className="muted text-[11.5px]">Computes target {oper} selected per row; non-numeric rows stay blank.</p></Block>
        <Block title="Filter rows & outliers" go={() => onPreview("removeRowsWhere", { column: col, operator: filterOp, value: filterVal })} label="Preview row removal">
          <div className="flex gap-1.5"><select className="select !w-[110px]" value={filterOp} onChange={(e) => setFilterOp(e.target.value)}><option value="equals">equals</option><option value="contains">contains</option><option value=">">&gt;</option><option value="<">&lt;</option></select>
            <input className="input flex-1" placeholder="Value" value={filterVal} onChange={(e) => setFilterVal(e.target.value)} /></div>
          <button className="btn btn-ghost btn-sm" onClick={() => onPreview("capOutliers", { column: col })}>Cap outliers at 3×IQR</button></Block>
      </div>
    </div>
  );
}
