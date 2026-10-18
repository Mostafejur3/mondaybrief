"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicShell, PageHead } from "@/components/shell";
import { api, money, Spinner } from "@/components/ui";
import { CheckCircle2 } from "lucide-react";

export default function Pricing() {
  const [pub, setPub] = useState<any>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  useEffect(() => { api("/api/public").then(setPub).catch(() => {}); }, []);
  const lim = (p: any, k: string) => p.limits?.[k];
  const rows: [string, (p: any) => string][] = [
    ["Max rows per dataset", (p) => Number(lim(p, "maxRowsPerDataset") || 0).toLocaleString()],
    ["Max file size", (p) => `${lim(p, "maxFileSizeMB")} MB`],
    ["Datasets per workspace", (p) => String(lim(p, "maxDatasets"))],
    ["Dashboards", (p) => String(lim(p, "maxDashboards"))],
    ["AI questions / month", (p) => Number(lim(p, "aiQuestionsPerMonth") || 0).toLocaleString()],
    ["Reports", (p) => String(lim(p, "maxReports"))],
    ["Automations & alerts", (p) => lim(p, "automation") ? "Included" : "—"],
    ["Database integrations", (p) => lim(p, "integrations") ? "Included" : "—"],
  ];
  return (
    <PublicShell>
      <PageHead title="Pricing" sub="Served live from the billing configuration — the same records used at checkout and in the admin plan manager. No hidden renewal conditions; cancel in two clicks." />
      <div className="max-w-7xl mx-auto px-4 pb-10">
        {pub?.billingMode === "development" && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-[13px] px-4 py-3 mb-5"><b>Development billing mode:</b> no payment provider is configured in this environment, so subscriptions activate locally <b>without any real charge</b> and invoices are labelled accordingly. Configure Stripe (see Docs) for live payments.</div>}
        <div className="flex rounded-lg border w-fit overflow-hidden mb-5" style={{ borderColor: "var(--border)" }}>
          {(["monthly", "yearly"] as const).map((c) => <button key={c} onClick={() => setCycle(c)} className={`px-4 py-2 text-[13px] font-bold capitalize ${cycle === c ? "text-white" : ""}`} style={cycle === c ? { background: "var(--brand)" } : {}}>{c}</button>)}
        </div>
        {!pub ? <Spinner /> : (
          <>
            <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3.5">
              {pub.plans.map((p: any) => (
                <div key={p.id} className={`card p-4 flex flex-col ${p.id === "pro" ? "ring-2 ring-emerald-500" : ""}`}>
                  <p className="font-extrabold">{p.name}</p><p className="muted text-[12px]">{p.tagline}</p>
                  <p className="mt-2.5">{p.id === "enterprise" ? <span className="text-[20px] font-extrabold">Custom</span> : <><span className="text-[24px] font-extrabold">{money(cycle === "yearly" ? p.priceYearly : p.priceMonthly).replace(".00", "")}</span><span className="muted text-[12px]">/{cycle === "yearly" ? "yr" : "mo"}</span></>}</p>
                  <ul className="mt-3 space-y-1.5 flex-1">{(p.features || []).map((f: string) => <li key={f} className="flex gap-1.5 text-[12px]"><CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />{f}</li>)}</ul>
                  <Link href={p.id === "enterprise" ? "/contact" : "/register"} className={`btn mt-4 justify-center ${p.id === "pro" ? "btn-primary" : "btn-ghost"}`}>{p.id === "enterprise" ? "Contact sales" : "Get " + p.name}</Link>
                </div>
              ))}
            </div>
            <div className="card overflow-auto mt-6">
              <table className="data"><thead><tr><th>Limit / capability</th>{pub.plans.map((p: any) => <th key={p.id}>{p.name}</th>)}</tr></thead>
                <tbody>{rows.map(([label, fn]) => <tr key={label}><td className="font-semibold">{label}</td>{pub.plans.map((p: any) => <td key={p.id}>{fn(p)}</td>)}</tr>)}</tbody></table>
            </div>
            <p className="muted text-[12.5px] mt-4">The public demo is always free and limited to {pub.demoRowLimit} data rows (enforced server-side). Limits are adjustable by administrators in Admin → Plans & Entitlements, subject to infrastructure safety caps. The standard synchronous processing target is 10,000 rows; higher plan ceilings are hard caps, and oversized files are rejected with an explanation rather than partially processed.</p>
          </>
        )}
      </div>
    </PublicShell>
  );
}
