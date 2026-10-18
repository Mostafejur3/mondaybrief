"use client";
import Link from "next/link";
import { PublicShell, PageHead } from "@/components/shell";
export default function About() {
  return (
    <PublicShell>
      <PageHead title="About MondayBrief AI" sub="An end-to-end business data workspace for people who live in spreadsheets — e-commerce teams, SMBs, agencies, analysts and operations, finance and sales teams." />
      <div className="max-w-4xl mx-auto px-4 pb-10 space-y-4 text-[14.5px] leading-relaxed">
        <p>Every Monday, someone opens the same export, fixes the same date formats, removes the same duplicates, and rebuilds the same charts — hoping nothing drifted since last week. MondayBrief AI exists to make that hour disappear <b>without</b> hiding what changed.</p>
        <p>Our core bet is simple: <b>transparent data cleaning combined with explainable AI analysis</b>. The cleaning studio shows every issue at the exact cell, previews every fix before/after, and keeps an audit trail you can revert. The AI analyst doesn't hallucinate numbers — it runs validated calculations and shows its method, its assumptions, and its limits.</p>
        <p>We serve beginners who need their first trustworthy chart today, and experienced analysts who want reproducible recipes, dashboards and reports they can defend in a meeting. We won't invent customer logos or user counts, and we won't call a feature “connected” until a real test passes. That honesty is the product.</p>
        <div className="card p-5 grid sm:grid-cols-3 gap-3 text-center">
          {[["Transparent", "Every fix previewed; every number traceable"], ["Trustworthy", "Deterministic math, honest refusals"], ["Useful fast", "First insight in minutes, depth for later"]].map(([t, b]) => <div key={t}><p className="font-extrabold">{t}</p><p className="muted text-[12.5px]">{b}</p></div>)}
        </div>
        <p className="text-center pt-2"><Link href="/demo" className="btn btn-primary">See the product, not a pitch</Link></p>
      </div>
    </PublicShell>
  );
}
