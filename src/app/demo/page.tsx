"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PublicShell } from "@/components/shell";
import { Studio } from "@/components/studio";
import { DashboardGrid, applyFilters } from "@/components/dashboardView";
import { Chart } from "@/components/charts";
import { api, post, useToast, Spinner, ErrBox, download, rowsToCsv, Meter } from "@/components/ui";
import { parseFile } from "@/lib/parseFile";
import { inferColumns, generateQuestions } from "@/lib/dataEngine";
import { Download, Gauge, MessageSquareText, RotateCcw, UploadCloud } from "lucide-react";

export default function Demo() {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [stack, setStack] = useState<any[]>([]);
  const [tab, setTab] = useState<"studio" | "dashboard" | "ask">("studio");
  const [question, setQuestion] = useState("Which product generated the most revenue?");
  const [answer, setAnswer] = useState<any>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try { const d = await api("/api/demo"); setData(d); setHistory([]); setStack([]); setAnswer(null); setFilters({}); }
    catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const rows = data?.rows || []; const columns = data?.columns || [];
  const questions = useMemo(() => rows.length ? generateQuestions(rows, inferColumns(rows)).filter((q) => q.answerable).slice(0, 8) : [], [rows]);
  const filteredRows = useMemo(() => applyFilters(rows, filters), [rows, filters]);

  const apply = async (op: string, params: any) => {
    setBusy(true);
    try {
      const r = await post("/api/demo", { action: "clean", rows, columns, op, params });
      setStack((s) => [...s, { rows, columns }]);
      setHistory((h) => [{ id: String(Date.now()), operation: op, params, affectedRows: r.affectedRows, affectedCells: r.affectedCells, beforeScore: data.quality.score, afterScore: r.quality.score, status: "applied", createdAt: new Date().toISOString() }, ...h]);
      setData({ ...data, rows: r.rows, columns: r.columns, quality: r.quality });
    } finally { setBusy(false); }
  };
  const revert = () => {
    setStack((s) => { const prev = s[s.length - 1]; if (prev) setData((d: any) => ({ ...d, rows: prev.rows, columns: prev.columns })); return s.slice(0, -1); });
    setHistory((h) => h.map((x, i) => i === 0 ? { ...x, status: "reverted" } : x));
    toast("Reverted to the previous snapshot", "info");
  };
  const ask = async (q?: string) => {
    const text = q || question; if (q) setQuestion(q);
    setBusy(true);
    try { const r = await post("/api/demo", { action: "ask", rows, columns, question: text }); setAnswer(r); setTab("ask"); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const onUpload = async (f: File) => {
    setBusy(true);
    try {
      const parsed = await parseFile(f);
      const r = await post("/api/demo", { action: "upload", rows: parsed.rows });
      setData(r); setHistory([]); setStack([]); setTab("studio");
      toast(`Loaded your file into the demo sandbox (${r.rowCount} rows). It is not saved anywhere.`);
    } catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  if (err) return <PublicShell><div className="max-w-3xl mx-auto px-4 py-12"><ErrBox msg={err} /></div></PublicShell>;
  if (!data) return <PublicShell><div className="max-w-5xl mx-auto px-4 py-12"><Spinner label="Preparing the 100-row demo dataset…" /></div></PublicShell>;

  return (
    <PublicShell>
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 py-5">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight flex items-center gap-2.5">Interactive demo <span className="badge b-amber">Demo Mode</span></h1>
            <p className="muted text-[13px]">Fictional e-commerce data — exactly 100 rows, enforced server-side. Edits stay in this browser session only.</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.json,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><UploadCloud size={14} /> Try your own file (≤100 rows)</button>
            <button className="btn btn-ghost btn-sm" onClick={() => download("mondaybrief-demo-cleaned.csv", rowsToCsv(rows, columns))}><Download size={14} /> Export CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { load(); toast("Demo reset to its original 100 rows", "info"); }}><RotateCcw size={14} /> Reset demo</button>
            <Link href="/register" className="btn btn-primary btn-sm">Save work — create free account</Link>
          </div>
        </div>

        <div className="card p-3 mb-3 flex flex-wrap items-center gap-4">
          <div className="w-[240px]"><Meter value={rows.length} max={data.rowLimit} label="Demo rows used" /></div>
          <p className="text-[12.5px] muted flex-1 min-w-[240px]">{data.expected?.note} Uploads beyond {data.rowLimit} rows are <b>rejected by the server</b> (try it) — never silently truncated. Registered plans process up to 1,000–200,000+ rows.</p>
          <div className="flex gap-1.5">
            {(["studio", "dashboard", "ask"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`btn btn-sm capitalize ${tab === t ? "btn-primary" : "btn-ghost"}`}>
                {t === "studio" ? "Cleaning Studio" : t === "dashboard" ? <><Gauge size={13} /> Dashboard</> : <><MessageSquareText size={13} /> Ask AI</>}
              </button>
            ))}
          </div>
        </div>

        {tab === "studio" && <Studio rows={rows} columns={columns} onApply={apply} busy={busy} history={history} onRevert={stack.length ? revert : undefined} />}

        {tab === "dashboard" && (
          <div>
            {Object.entries(filters).filter(([, v]) => v).length > 0 && (
              <div className="card p-2.5 mb-3 flex flex-wrap gap-2 items-center text-[12.5px]">
                <b>Cross-filter active:</b>
                {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => <span key={k} className="badge b-blue">{k} = {v}</span>)}
                <button className="link" onClick={() => setFilters({})}>Clear</button>
                <span className="muted">(click any bar to filter all charts)</span>
              </div>
            )}
            <DashboardGrid widgets={data.widgets || []} rows={filteredRows} theme="emerald" onSelect={(dim, label) => setFilters({ [dim]: label })} />
          </div>
        )}

        {tab === "ask" && (
          <div className="grid lg:grid-cols-[320px_1fr] gap-4">
            <div className="card p-4 h-fit">
              <p className="font-bold text-[13.5px] mb-2">Sample business questions</p>
              <p className="muted text-[12px] mb-3">Generated from this dataset's actual columns and validated as answerable.</p>
              <div className="space-y-1.5">{questions.map((q: any) => <button key={q.question} onClick={() => ask(q.question)} className="w-full text-left btn btn-ghost btn-sm !whitespace-normal justify-start">{q.question}</button>)}</div>
              <p className="muted text-[11.5px] mt-3">Demo results are labelled as such and computed from the fictional sample data.</p>
            </div>
            <div>
              <div className="card p-3.5 flex gap-2 mb-3">
                <input className="input flex-1" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Ask about revenue, products, regions, trends, profit…" aria-label="Business question" />
                <button className="btn btn-primary" disabled={busy} onClick={() => ask()}>Ask</button>
              </div>
              {answer ? (
                <div className="card p-5">
                  <span className="badge b-amber">{answer.label}</span>
                  <p className="text-[15.5px] font-semibold mt-2.5 leading-relaxed">{answer.answer.answer}</p>
                  {answer.answer.numbers?.length > 0 && <div className="flex flex-wrap gap-2 mt-3">{answer.answer.numbers.map((n: any) => <span key={n.label} className="badge b-emerald !text-[12px] !py-1">{n.label}: {n.value}</span>)}</div>}
                  {answer.answer.chart && <div className="mt-4"><p className="font-bold text-[13px] mb-1">{answer.answer.chart.title}</p><Chart type={answer.answer.chart.type} data={answer.answer.chart.data} /></div>}
                  <div className="grid sm:grid-cols-2 gap-3 mt-4 text-[12.5px]">
                    <div className="rounded-lg p-3" style={{ background: "var(--surface2)" }}><b>Calculation method</b><p className="muted mt-1">{answer.answer.method}</p></div>
                    <div className="rounded-lg p-3" style={{ background: "var(--surface2)" }}><b>Columns & period</b><p className="muted mt-1">{answer.answer.columns.join(", ")} · {answer.answer.period}</p></div>
                    <div className="rounded-lg p-3" style={{ background: "var(--surface2)" }}><b>Assumptions</b><ul className="muted mt-1 list-disc ml-4">{(answer.answer.assumptions || ["None"]).map((a: string) => <li key={a}>{a}</li>)}</ul></div>
                    <div className="rounded-lg p-3" style={{ background: "var(--surface2)" }}><b>Confidence</b><p className="muted mt-1">{answer.answer.confidence}</p></div>
                  </div>
                  {answer.answer.followups?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{answer.answer.followups.map((f: string) => <button key={f} className="btn btn-ghost btn-sm" onClick={() => ask(f)}>{f}</button>)}</div>}
                </div>
              ) : <div className="card p-8 text-center muted text-[13px]">Pick a sample question or type your own. Numbers are computed from the 100 demo rows — the method is always shown.</div>}
            </div>
          </div>
        )}

        <div className="card p-4 mt-4 flex flex-wrap items-center gap-3">
          <p className="text-[13px]"><b>Like what you see?</b> A free account keeps your datasets, cleaning history, dashboards and reports — and lifts the limit to 1,000 rows per dataset.</p>
          <Link href="/register" className="btn btn-primary btn-sm ml-auto">Create free account</Link>
          <Link href="/pricing" className="btn btn-ghost btn-sm">Compare plans</Link>
        </div>
      </div>
    </PublicShell>
  );
}
