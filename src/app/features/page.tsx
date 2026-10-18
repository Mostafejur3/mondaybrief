"use client";
import Link from "next/link";
import { PublicShell, PageHead } from "@/components/shell";
import { ArrowRight } from "lucide-react";

const sections = [
  { id: "data-hub", t: "Data Hub & File Import", pts: ["CSV, TSV, TXT, JSON and XLSX with sheet selection and header preview", "Automatic delimiter handling, column type inference and duplicate-file awareness", "Plan limits enforced on the server — files are rejected with a reason, never silently truncated", "File browser with quality scores, row/column counts, rename, duplicate, archive and delete"] },
  { id: "cleaning", t: "Data Cleaning Studio", pts: ["Profiling: missing %, unique values, min/max/mean/median/percentiles, date ranges, category frequencies", "Issue explorer: exact row, column, value, explanation, proposed fix and confidence for every finding", "Operations: trim, casing, normalize labels, dedupe, dates, number conversion, missing-value strategies, split/merge, calculated columns, outlier capping, find & replace, row filters", "Before/after diffs for every change, undo snapshots, saved recipes and a full transformation audit trail", "Invalid values (e.g. 13/32/2025) are flagged for human review — replacements are never invented"] },
  { id: "dashboards", t: "Dashboard Builder", pts: ["Templates: Executive, Sales, Finance, E-commerce, Operations, blank canvas", "KPIs, line/area/bar/donut, histograms, funnels, scatter plots, tables and text notes", "Reorder by drag & drop, resize cards, per-widget metric/dimension/aggregation, 5 theme presets", "Global filters + cross-filtering by clicking a chart segment, version history with restore"] },
  { id: "analyst", t: "AI Business Analyst", pts: ["Answers are computed by a deterministic, validated analytics layer — a language model never invents a number", "Every answer includes the figure, method, source columns, period, assumptions, confidence and follow-ups", "Unanswerable questions get an honest refusal plus answerable alternatives", "Usage is metered per plan and tracked for audit"] },
  { id: "questions", t: "Business Question Generator", pts: ["Questions derived from your actual columns, types and time coverage", "Grouped by Revenue, Profitability, Customers, Products, Trends, Operations and Anomalies", "Each question is validated: if the required fields don't exist, it's marked not-answerable instead of faked"] },
  { id: "reports", t: "Reports & Export Center", pts: ["Executive summary, weekly brief, sales/financial analysis, data-quality and cleaning-audit reports", "Download real files: printable PDF (via browser print), CSV and XLSX — formula-injection-safe CSV", "Add your own commentary; regenerate any time to refresh figures"] },
  { id: "automation", t: "Automations & Alerts", pts: ["Chain steps: validate → apply recipe → generate report → check alerts → notify", "Threshold alerts on any metric or on the data-quality score, with in-app notifications", "Every run is logged step-by-step; schedules are stored for a production worker to execute"] },
  { id: "integrations", t: "Integrations & Database Connections", pts: ["PostgreSQL connections with a genuine connectivity + authentication test and table inspection", "Preview and import table data (read-only, row-limited) into a dataset", "Secrets encrypted server-side; the full credential is never returned to the browser", "Unsupported connectors are labelled honestly as not configured — never shown as “connected” without a passed test"] },
];
export default function Features() {
  return (
    <PublicShell>
      <PageHead title="Product features" sub="One workspace for the full journey: upload → inspect → clean → validate → analyze → dashboards → questions → reports → automate." />
      <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-[210px_1fr] gap-6 pb-6">
        <aside className="hidden lg:block"><div className="sticky top-24 card p-3 space-y-1">{sections.map((s) => <a key={s.id} href={`#${s.id}`} className="block text-[13px] font-semibold px-2 py-1.5 rounded-lg hover:bg-black/5">{s.t}</a>)}</div></aside>
        <div className="space-y-4">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="card p-5 scroll-mt-24">
              <h2 className="text-[19px] font-extrabold">{s.t}</h2>
              <ul className="mt-3 space-y-1.5">{s.pts.map((p) => <li key={p} className="flex gap-2 text-[13.5px]"><span className="text-emerald-600 font-bold">✓</span>{p}</li>)}</ul>
            </section>
          ))}
          <div className="card p-5 text-center">
            <p className="font-bold mb-2">Don't take our word for it — every feature above works in the public demo.</p>
            <Link href="/demo" className="btn btn-primary">Open the 100-row demo<ArrowRight size={15} /></Link>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
