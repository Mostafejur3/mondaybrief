"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/shell";
import { api, money, Spinner } from "@/components/ui";
import { Chart } from "@/components/charts";
import { ArrowRight, CheckCircle2, Database, FileSpreadsheet, Gauge, MessageSquareText, PlayCircle, ShieldCheck, UploadCloud, Wand2, Workflow } from "lucide-react";

const demoChart = [
  { label: "2025-07", value: 12400 }, { label: "2025-08", value: 14980 }, { label: "2025-09", value: 13820 },
  { label: "2025-10", value: 17340 }, { label: "2025-11", value: 19610 }, { label: "2025-12", value: 22130 },
];
const demoBars = [
  { label: "Electronics", value: 23150 }, { label: "Furniture", value: 19840 }, { label: "Apparel", value: 9120 },
  { label: "Fitness", value: 6640 }, { label: "Beauty", value: 4210 },
];

export default function Home() {
  const [pub, setPub] = useState<any>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [faqOpen, setFaqOpen] = useState(0);
  useEffect(() => { api("/api/public").then(setPub).catch(() => {}); }, []);
  const cms = pub?.cms;

  return (
    <PublicShell>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 420px at 75% -60px, rgba(16,185,129,.16), transparent), radial-gradient(700px 380px at 8% 20px, rgba(14,165,233,.12), transparent)" }} />
        <div className="max-w-7xl mx-auto px-4 pt-12 pb-10 grid lg:grid-cols-2 gap-10 items-center">
          <div className="fade-up">
            <span className="badge b-emerald">From messy data to meaningful decisions</span>
            <h1 className="text-[34px] sm:text-[44px] leading-[1.06] font-extrabold tracking-tight mt-4">{cms?.heroHeadline || "Turn Messy Data Into Clear Business Decisions."}</h1>
            <p className="muted text-[16px] mt-4 max-w-xl">{cms?.heroSub || "Upload a spreadsheet, review every proposed fix before it applies, and ask business questions answered from your actual numbers — never invented."}</p>
            <div className="flex flex-wrap gap-2.5 mt-6">
              <Link href="/demo" className="btn btn-primary !px-5 !py-3 !text-[15px]"><PlayCircle size={18} />{cms?.primaryCta || "Try the Free Demo"}</Link>
              <Link href="/features" className="btn btn-ghost !px-5 !py-3 !text-[15px]">{cms?.secondaryCta || "Explore Features"}<ArrowRight size={16} /></Link>
            </div>
            <ul className="mt-6 space-y-1.5 text-[13.5px]">
              {["No sign-up needed for the 100-row interactive demo", "Every cleaning fix is previewed before/after — nothing changes silently", "AI answers cite the exact calculation, columns and assumptions"].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />{t}</li>)}
            </ul>
          </div>
          {/* Live product preview */}
          <div className="glass rounded-2xl shadow-2xl p-4 fade-up" aria-label="Product preview (sample data)">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 text-[12px] font-bold">Sales dashboard — sample data</span>
              <span className="badge b-amber ml-auto">Demo preview</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              {[["Total revenue", "100,280"], ["Orders", "97"], ["Data quality", "82/100"]].map(([l, v]) => (
                <div key={l} className="card p-2.5"><p className="text-[10.5px] muted font-bold uppercase tracking-wide">{l}</p><p className="font-extrabold text-[17px]">{v}</p></div>
              ))}
            </div>
            <div className="card p-3 mb-2.5"><p className="text-[12px] font-bold mb-1">Revenue by month</p><Chart type="area" data={demoChart} height={130} /></div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              <div className="card p-3"><p className="text-[12px] font-bold mb-1">Revenue by category</p><Chart type="bar" data={demoBars} height={120} /></div>
              <div className="card p-3">
                <p className="text-[12px] font-bold mb-1.5 flex items-center gap-1"><Wand2 size={13} className="text-emerald-600" /> Detected issue</p>
                <p className="text-[12px]"><b>Row 24 → Order Date → “13/32/2025”</b></p>
                <p className="text-[11.5px] muted mt-1">Invalid date (month 13). MondayBrief flags it for review instead of inventing a replacement.</p>
                <Link href="/demo" className="btn btn-primary btn-sm mt-2">Try fixing it in the demo</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-[26px] font-extrabold tracking-tight">Spreadsheets break in predictable ways. Reporting shouldn't.</h2>
        <div className="grid md:grid-cols-3 gap-3.5 mt-5">
          {[["Messy inputs", "Mixed date formats, duplicates, numbers stored as text, phantom categories from a stray space. Most tools silently swallow these — and your totals drift."],
            ["Repetitive cleaning", "The same fixes, redone by hand every Monday. Without an audit trail, nobody can reproduce last month's numbers."],
            ["Fragmented answers", "Cleaning in one tool, charts in another, questions in a chat window that can't see your data (and invents figures)."]].map(([t, b]) => (
            <div key={t} className="card p-4"><p className="font-bold text-[15px] mb-1.5">{t}</p><p className="muted text-[13px]">{b}</p></div>
          ))}
        </div>
        <p className="text-[14px] mt-4"><b>MondayBrief connects the whole journey:</b> Upload → Inspect → Clean (with review) → Validate → Analyze → Dashboards → Ask questions → Reports → Automate.</p>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-[26px] font-extrabold tracking-tight">Everything between “raw CSV” and “decision”</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
          {[
            [UploadCloud, "Data Hub & import", "CSV, TSV, JSON and XLSX with sheet/header preview, type inference, plan-limit enforcement and full import history.", "/features#data-hub"],
            [Wand2, "Data Cleaning Studio", "Issue explorer traceable to the exact cell, before/after previews, undo snapshots, reusable recipes and a complete audit trail.", "/features#cleaning"],
            [Gauge, "Dashboard Builder", "Drag, resize and configure KPIs and charts. Templates for sales, finance, e-commerce, operations and executive overviews.", "/features#dashboards"],
            [MessageSquareText, "AI Business Analyst", "Ask “why did revenue dip?” and get numbers computed by a validated analytics layer — with method, period and assumptions attached.", "/features#analyst"],
            [FileSpreadsheet, "Reports & exports", "Executive briefs and data-quality reports you can download as PDF (print), CSV or XLSX. Real files, generated from real rows.", "/features#reports"],
            [Workflow, "Automations & alerts", "Validate → apply recipe → report → notify. Threshold alerts on any metric, with a full run history.", "/features#automation"],
            [Database, "Database integrations", "Connect PostgreSQL with a real connection test, inspect tables and import — secrets encrypted, never shown again.", "/features#integrations"],
            [ShieldCheck, "Workspace isolation", "Server-side authorization on every request. Roles for owners, admins, editors and viewers. Admin audit log included.", "/security"],
            [CheckCircle2, "Business Questions", "Questions generated from your actual columns — validated for answerability before they're suggested.", "/features#questions"],
          ].map(([Icon, t, b, href]: any) => (
            <Link key={t} href={href} className="card p-4 hover:shadow-md transition-shadow block">
              <span className="w-9 h-9 rounded-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-2.5"><Icon size={18} /></span>
              <p className="font-bold text-[14.5px]">{t}</p><p className="muted text-[12.5px] mt-1">{b}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="card p-5 sm:p-6" style={{ background: "linear-gradient(135deg, rgba(5,150,105,.06), rgba(14,165,233,.05))" }}>
          <h2 className="text-[22px] font-extrabold tracking-tight">How it works</h2>
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            {["Upload data", "Review issues", "Preview & apply fixes", "Build dashboards", "Ask questions", "Report & automate"].map((s, i) => (
              <div key={s} className="text-center"><span className="w-9 h-9 rounded-full text-white font-extrabold flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg,#059669,#0d9488)" }}>{i + 1}</span><p className="font-semibold text-[12.5px] mt-2">{s}</p></div>
            ))}
          </div>
          <div className="text-center mt-5"><Link href="/demo" className="btn btn-primary">See it on the 100-row demo<ArrowRight size={15} /></Link></div>
        </div>
      </section>

      {/* PRICING (from backend) */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[26px] font-extrabold tracking-tight">Simple, honest pricing</h2>
          <div className="ml-auto flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {(["monthly", "yearly"] as const).map((c) => <button key={c} onClick={() => setCycle(c)} className={`px-3.5 py-1.5 text-[13px] font-bold capitalize ${cycle === c ? "text-white" : ""}`} style={cycle === c ? { background: "var(--brand)" } : {}}>{c}{c === "yearly" ? " (−17%)" : ""}</button>)}
          </div>
        </div>
        <p className="muted text-[13px] mt-1">Prices are served from the billing configuration — the same records the app uses at checkout.{pub?.billingMode === "development" && <span className="font-semibold"> This environment runs in development billing mode: no real charges occur.</span>}</p>
        {!pub ? <Spinner /> : (
          <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3.5 mt-5">
            {pub.plans.map((p: any) => {
              const price = cycle === "yearly" ? p.priceYearly : p.priceMonthly;
              const hot = p.id === "pro";
              return (
                <div key={p.id} className={`card p-4.5 p-4 flex flex-col ${hot ? "ring-2 ring-emerald-500 shadow-lg" : ""}`}>
                  {hot && <span className="badge b-emerald self-start mb-2">Most popular</span>}
                  <p className="font-extrabold text-[16px]">{p.name}</p><p className="muted text-[12px]">{p.tagline}</p>
                  <p className="mt-3">{p.id === "enterprise" ? <span className="text-[20px] font-extrabold">Custom</span> : <><span className="text-[26px] font-extrabold">{money(price).replace(".00", "")}</span><span className="muted text-[12px]"> / {cycle === "yearly" ? "year" : "month"}</span></>}</p>
                  <ul className="mt-3 space-y-1.5 flex-1">{(p.features || []).slice(0, 6).map((f: string) => <li key={f} className="flex gap-1.5 text-[12px]"><CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />{f}</li>)}</ul>
                  <Link href={p.id === "enterprise" ? "/contact" : "/register"} className={`btn mt-4 justify-center ${hot ? "btn-primary" : "btn-ghost"}`}>{p.id === "enterprise" ? "Contact sales" : p.priceMonthly === 0 ? "Start free" : "Start now"}</Link>
                </div>
              );
            })}
          </div>
        )}
        <p className="muted text-[12px] mt-3">No hidden renewal tricks. Cancel anytime; your data remains exportable. <Link href="/pricing" className="link">Full comparison →</Link></p>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-[26px] font-extrabold tracking-tight mb-4">Frequently asked questions</h2>
        {(cms?.faq || []).map((f: any, i: number) => (
          <div key={i} className="card mb-2 overflow-hidden">
            <button className="w-full text-left px-4 py-3 font-bold text-[14px] flex justify-between items-center" onClick={() => setFaqOpen(faqOpen === i ? -1 : i)} aria-expanded={faqOpen === i}>{f.q}<span>{faqOpen === i ? "−" : "+"}</span></button>
            {faqOpen === i && <p className="px-4 pb-3.5 muted text-[13px]">{f.a}</p>}
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-2xl p-8 text-center text-white" style={{ background: "linear-gradient(135deg,#065f46,#0d9488)" }}>
          <h2 className="text-[26px] font-extrabold">Your next Monday brief writes itself.</h2>
          <p className="opacity-90 text-[14px] mt-2 max-w-xl mx-auto">Open the demo, fix a real data problem in under a minute, and see exactly how every number was computed.</p>
          <div className="flex justify-center gap-2.5 mt-5 flex-wrap">
            <Link href="/demo" className="btn !bg-white !text-emerald-800 !px-5 !py-2.5 font-bold">Try the free demo</Link>
            <Link href="/register" className="btn border border-white/50 text-white !px-5 !py-2.5">Create free account</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
