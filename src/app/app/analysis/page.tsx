"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, ErrBox, Empty, download, rowsToCsv } from "@/components/ui";
import { Chart, DataTable } from "@/components/charts";
import { computeWidget, inferColumns, groupBy, timeSeries, correlate, toNumber } from "@/lib/dataEngine";
import { Download, Plus } from "lucide-react";

export default function Analysis() {
  const session = useSession(); const toast = useToast();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [dsId, setDsId] = useState("");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [dim, setDim] = useState(""); const [metric, setMetric] = useState(""); const [agg, setAgg] = useState("sum"); const [chartType, setChartType] = useState("bar");
  const [corrA, setCorrA] = useState(""); const [corrB, setCorrB] = useState("");
  const [dashName, setDashName] = useState("");

  useEffect(() => {
    if (!session.wsId) return;
    api(`/api/datasets?workspaceId=${session.wsId}`).then((d) => {
      setDatasets(d.datasets.filter((x: any) => x.status === "active"));
      const fromUrl = new URLSearchParams(window.location.search).get("dataset");
      setDsId(fromUrl && d.datasets.some((x: any) => x.id === fromUrl) ? fromUrl : d.datasets.find((x: any) => x.status === "active")?.id || "");
    }).catch((e) => setErr(e.message));
  }, [session.wsId]);

  const load = useCallback(async () => {
    if (!dsId) return;
    try { const d = await api(`/api/datasets/${dsId}?view=analysis`); setData(d);
      const cols = d.columns; const meta = inferColumns(d.rows);
      setDim(cols.find((c: string) => meta.find((m: any) => m.name === c)?.type === "text") || cols[0] || "");
      setMetric(cols.find((c: string) => d.rows.some((r: any) => toNumber(r[c]) !== null)) || cols[0] || "");
    } catch (e: any) { setErr(e.message); }
  }, [dsId]);
  useEffect(() => { load(); }, [load]);

  const rows = data?.rows || []; const cols: string[] = data?.columns || [];
  const meta = useMemo(() => (rows.length ? inferColumns(rows) : []), [rows]);
  const numericCols = cols.filter((c) => rows.some((r: any) => toNumber(r[c]) !== null));
  const custom = useMemo(() => {
    if (!rows.length) return [];
    if (chartType === "line" || chartType === "area") { const dc = meta.find((m: any) => m.type === "date" || /date/i.test(m.name))?.name; return dc ? timeSeries(rows, dc, metric, agg) : []; }
    return groupBy(rows, dim, metric, agg).slice(0, 12);
  }, [rows, dim, metric, agg, chartType, meta]);
  const corr = corrA && corrB ? correlate(rows, corrA, corrB) : null;

  const saveToDashboard = async () => {
    try {
      const widget = { id: Math.random().toString(36).slice(2, 9), type: chartType, title: dashName || `${agg}(${metric}) by ${chartType === "line" || chartType === "area" ? "month" : dim}`, metric, dimension: dim, agg, time: chartType === "line" || chartType === "area", width: 6, color: "#059669" };
      const r = await post("/api/work", { resource: "dashboards", action: "create", workspaceId: session.wsId, datasetId: dsId, name: `Analysis — ${data.dataset.name}`, widgets: [widget] });
      toast(`Saved as dashboard “${r.dashboard.name}”`);
    } catch (e: any) { toast(e.message, "error"); }
  };

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  return (
    <AppShell session={session} title="Analysis Workspace" subtitle="Descriptive statistics, trends, segmentation and correlations — all computed deterministically from the selected dataset version. Metrics that lack required fields are never fabricated.">
      {err && <ErrBox msg={err} />}
      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <label className="lbl !mb-0">Dataset</label>
        <select className="select !w-[300px]" value={dsId} onChange={(e) => setDsId(e.target.value)}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.rowCount} rows)</option>)}</select>
        {data && <span className="badge b-emerald ml-auto">quality {data.dataset.qualityScore}/100</span>}
      </div>
      {!dsId ? <Empty title="No dataset to analyze" body="Import a dataset in the Data Hub first." /> : !data ? <Spinner /> : (
        <div className="space-y-4">
          {data.suggestions?.length > 0 && (
            <div>
              <p className="font-extrabold text-[15px] mb-2">Suggested analyses — and why</p>
              <div className="grid lg:grid-cols-3 gap-3">
                {data.suggestions.map((s: any) => (
                  <div key={s.title} className="card p-3.5"><p className="font-bold text-[13.5px]">{s.title}</p><p className="muted text-[12px] mt-0.5">{s.why}</p>
                    <div className="mt-2"><Chart type={s.type} data={s.data} height={150} /></div></div>
                ))}
              </div>
            </div>
          )}
          <div className="card p-4">
            <p className="font-extrabold text-[15px] mb-3">Custom analysis builder</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <div><label className="lbl">Group by (dimension)</label><select className="select" value={dim} onChange={(e) => setDim(e.target.value)}>{cols.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="lbl">Metric</label><select className="select" value={metric} onChange={(e) => setMetric(e.target.value)}>{cols.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="lbl">Aggregation</label><select className="select" value={agg} onChange={(e) => setAgg(e.target.value)}>{["sum", "avg", "count", "min", "max"].map((a) => <option key={a}>{a}</option>)}</select></div>
              <div><label className="lbl">Chart</label><select className="select" value={chartType} onChange={(e) => setChartType(e.target.value)}>{["bar", "line", "area", "donut", "pie", "histogram", "table"].map((a) => <option key={a}>{a}</option>)}</select></div>
              <div><label className="lbl">Widget title (optional)</label><input className="input" value={dashName} onChange={(e) => setDashName(e.target.value)} placeholder="Auto" /></div>
            </div>
            <div className="mt-3">{chartType === "table" ? <DataTable data={custom} valueLabel={`${agg}(${metric})`} /> : <Chart type={chartType} data={custom} />}</div>
            <p className="muted text-[12px] mt-2">Method: {chartType === "line" || chartType === "area" ? `monthly ${agg}(${metric}) over parsed dates` : `${agg}(${metric}) grouped by ${dim} (trimmed labels)`}. Reproducible — same dataset version always yields the same result.</p>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-primary btn-sm" onClick={saveToDashboard}><Plus size={13} /> Save as dashboard</button>
              <button className="btn btn-ghost btn-sm" onClick={() => download(`analysis-${metric}-by-${dim}.csv`, `Group,${agg}(${metric})\n` + custom.map((c: any) => `${JSON.stringify(c.label)},${c.value}`).join("\n"))}><Download size={13} /> Export result CSV</button>
              <button className="btn btn-ghost btn-sm" onClick={() => download(`${data.dataset.name}-filtered.csv`, rowsToCsv(rows, cols))}>Export dataset CSV</button>
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="font-extrabold text-[14.5px] mb-2">Correlation explorer</p>
              <div className="flex gap-2">
                <select className="select" value={corrA} onChange={(e) => setCorrA(e.target.value)}><option value="">Column A…</option>{numericCols.map((c) => <option key={c}>{c}</option>)}</select>
                <select className="select" value={corrB} onChange={(e) => setCorrB(e.target.value)}><option value="">Column B…</option>{numericCols.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              {corr !== null && corrA && corrB ? <p className="text-[13.5px] mt-3">Pearson r(<b>{corrA}</b>, <b>{corrB}</b>) = <b className="text-[16px]">{corr}</b> — {Math.abs(corr) > 0.7 ? "strong" : Math.abs(corr) > 0.4 ? "moderate" : "weak"} {corr >= 0 ? "positive" : "negative"} linear association. Correlation ≠ causation.</p> : <p className="muted text-[12.5px] mt-3">Pick two numeric columns to compute their correlation.</p>}
              {(data.correlations || []).length > 0 && <div className="mt-3"><p className="font-bold text-[12.5px] mb-1">Strongest pairs (auto-scan)</p>{data.correlations.sort((a: any, b: any) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 5).map((c: any) => <p key={c.a + c.b} className="text-[12.5px] py-0.5">{c.a} ↔ {c.b}: <b>r = {c.r}</b></p>)}</div>}
            </div>
            <div className="card p-4">
              <p className="font-extrabold text-[14.5px] mb-2">Descriptive statistics</p>
              <div className="overflow-auto max-h-[240px]"><table className="data"><thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Min</th><th>Median</th><th>Mean</th><th>Max</th></tr></thead>
                <tbody>{(data.profiles || []).map((p: any) => <tr key={p.name}><td className="font-semibold">{p.name}</td><td>{p.type}</td><td>{p.missing} ({p.missingPct}%)</td><td>{p.unique}</td><td>{p.min ?? "—"}</td><td>{p.median ?? "—"}</td><td>{p.mean ?? "—"}</td><td>{p.max ?? "—"}</td></tr>)}</tbody></table></div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
