"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, Spinner, ErrBox, fmtDateTime, Meter } from "@/components/ui";
import { Chart } from "@/components/charts";
import { ArrowRight, CheckCircle2, Database, Gauge, MessageSquareText, UploadCloud, Wand2 } from "lucide-react";

export default function Overview() {
  const session = useSession();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!session.wsId) return;
    api(`/api/work?resource=overview&workspaceId=${session.wsId}`).then(setData).catch((e) => setErr(e.message));
  }, [session.wsId]);
  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  const limits = data?.plan?.limits || {};
  const onboarding = [
    { label: "Create your workspace", done: true },
    { label: "Import a dataset", done: (data?.stats.datasets || 0) > 0 },
    { label: "Clean & validate your data", done: (data?.stats.avgQuality || 0) >= 90 && (data?.stats.datasets || 0) > 0 },
    { label: "Build a dashboard", done: (data?.stats.dashboards || 0) > 0 },
    { label: "Ask a business question", done: false, href: "/app/analyst" },
    { label: "Generate a report", done: (data?.stats.reports || 0) > 0 },
  ];
  return (
    <AppShell session={session} title={`Welcome back, ${session.user.name.split(" ")[0]}`} subtitle={`${session.ws?.name || ""} · ${data?.plan?.name || ""} plan — everything below is computed from your actual workspace records.`}
      actions={<Link href="/app/data" className="btn btn-primary btn-sm"><UploadCloud size={14} /> Upload data</Link>}>
      {err && <ErrBox msg={err} />}
      {!data ? <Spinner /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[["Datasets", data.stats.datasets, Database], ["Rows stored", data.stats.rows.toLocaleString(), Database], ["Avg quality", `${data.stats.avgQuality}/100`, Wand2], ["Dashboards", data.stats.dashboards, Gauge], ["Reports", data.stats.reports, MessageSquareText]].map(([l, v, Icon]: any) => (
              <div key={l} className="card p-3.5"><Icon size={16} className="text-emerald-600 mb-1.5" /><p className="text-[20px] font-extrabold">{v}</p><p className="muted text-[11.5px] font-semibold uppercase tracking-wide">{l}</p></div>
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="card p-4 lg:col-span-2">
              <p className="font-bold text-[14px]">{data.headline ? `${data.headline.metric} trend — ${data.headline.dataset}` : "Get your first insight"}</p>
              {data.headline?.series?.length ? <div className="mt-2"><Chart type="area" data={data.headline.series} /></div>
                : <p className="muted text-[13px] mt-2">Upload a dataset with a date and a numeric column to see a live trend here. <Link href="/app/data" className="link">Go to Data Hub →</Link></p>}
              {data.headline?.groups?.length > 0 && <div className="mt-3"><p className="font-bold text-[13px] mb-1">{data.headline.metric} by {data.headline.groupName}</p><Chart type="bar" data={data.headline.groups} height={150} /></div>}
            </div>
            <div className="space-y-4">
              <div className="card p-4">
                <p className="font-bold text-[14px] mb-2.5">Onboarding checklist</p>
                {onboarding.map((o) => (
                  <div key={o.label} className="flex items-center gap-2 py-1 text-[13px]">
                    <CheckCircle2 size={15} className={o.done ? "text-emerald-600" : "text-slate-300"} />
                    <span className={o.done ? "muted line-through" : ""}>{o.label}</span>
                    {!o.done && o.href && <Link href={o.href} className="link text-[12px] ml-auto">Do it</Link>}
                  </div>
                ))}
              </div>
              <div className="card p-4 space-y-3">
                <p className="font-bold text-[14px]">Plan usage — {data.plan?.name}</p>
                <Meter value={data.stats.datasets} max={Number(limits.maxDatasets || 3)} label="Datasets" />
                <Meter value={data.stats.dashboards} max={Number(limits.maxDashboards || 2)} label="Dashboards" />
                <Meter value={data.stats.reports} max={Number(limits.maxReports || 2)} label="Reports" />
                <p className="muted text-[11.5px]">Rows per dataset limit: {Number(limits.maxRowsPerDataset || 0).toLocaleString()} · AI questions/month: {Number(limits.aiQuestionsPerMonth || 0).toLocaleString()}</p>
                <Link href="/app/billing" className="btn btn-ghost btn-sm">Manage plan</Link>
              </div>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <div className="flex items-center mb-2"><p className="font-bold text-[14px]">Recent datasets</p><Link href="/app/data" className="link text-[12px] ml-auto">Data Hub <ArrowRight size={12} className="inline" /></Link></div>
              {data.datasets.length === 0 ? <p className="muted text-[13px]">No datasets yet.</p> : data.datasets.map((d: any) => (
                <Link key={d.id} href={`/app/datasets/${d.id}`} className="flex items-center gap-2 py-2 border-b last:border-0 text-[13px]" style={{ borderColor: "var(--border)" }}>
                  <Database size={15} className="text-emerald-600" /><span className="font-semibold truncate">{d.name}</span>
                  <span className="ml-auto muted">{d.rowCount} rows</span><span className={`badge ${d.qualityScore >= 90 ? "b-emerald" : d.qualityScore >= 70 ? "b-amber" : "b-red"}`}>{d.qualityScore}/100</span>
                </Link>
              ))}
            </div>
            <div className="card p-4">
              <p className="font-bold text-[14px] mb-2">Recent activity (jobs)</p>
              {data.jobs.length === 0 ? <p className="muted text-[13px]">Imports, reports and automation runs will appear here.</p> : data.jobs.map((j: any) => (
                <div key={j.id} className="flex items-center gap-2 py-1.5 text-[12.5px] border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                  <span className={`badge ${j.status === "completed" ? "b-emerald" : "b-red"}`}>{j.status}</span>
                  <span className="font-semibold capitalize">{j.type}</span><span className="muted ml-auto">{fmtDateTime(j.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
