"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, ErrBox, Modal, Confirm, Empty, fmtDateTime, download } from "@/components/ui";
import { Chart, DataTable } from "@/components/charts";
import { Download, FileText, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

const TYPES: [string, string][] = [["executive", "Executive summary"], ["weekly_brief", "Weekly business brief"], ["monthly", "Monthly performance"], ["sales", "Sales analysis"], ["financial", "Financial analysis"], ["data_quality", "Data quality report"], ["cleaning_audit", "Cleaning audit report"], ["custom", "Custom analytical report"]];

export default function Reports() {
  const session = useSession(); const toast = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [openId, setOpenId] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", type: "executive", datasetId: "", commentary: "" });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [commentaryDraft, setCommentaryDraft] = useState("");

  const load = useCallback(async () => {
    if (!session.wsId) return;
    try {
      const d = await api(`/api/work?resource=reports&workspaceId=${session.wsId}`); setReports(d.reports);
      const ds = await api(`/api/datasets?workspaceId=${session.wsId}`);
      setDatasets(ds.datasets.filter((x: any) => x.status === "active"));
      const fromUrl = new URLSearchParams(window.location.search).get("dataset");
      setForm((f) => ({ ...f, datasetId: fromUrl || ds.datasets.find((x: any) => x.status === "active")?.id || "" }));
    } catch (e: any) { setErr(e.message); }
  }, [session.wsId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try { const r = await post("/api/work", { resource: "reports", action: "create", workspaceId: session.wsId, ...form }); toast("Report generated from the current dataset version"); setShowNew(false); setOpenId(r.report.id); await load(); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const open = reports.find((r) => r.id === openId);
  useEffect(() => { setCommentaryDraft(open?.content?.commentary || ""); }, [openId]); // eslint-disable-line

  const exportXlsx = (r: any) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.content.kpis || []), "KPIs");
    if (r.content.trend?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.content.trend), "Trend");
    if (r.content.groups?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.content.groups), "Groups");
    if (r.content.quality?.issues?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.content.quality.issues), "Quality issues");
    XLSX.writeFile(wb, `${r.name}.xlsx`); toast("XLSX exported");
  };
  const exportCsv = (r: any) => download(`${r.name}.csv`, `Metric,Value\n${(r.content.kpis || []).map((k: any) => `${JSON.stringify(k.label)},${JSON.stringify(k.value)}`).join("\n")}`);

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  return (
    <AppShell session={session} title="Reports & Export Center" subtitle="Reports are generated from the exact dataset version at generation time, with methods attached. Download real CSV/XLSX files or print to PDF. Scheduled email delivery activates once an email provider is configured — until then, nothing claims to be 'sent'. "
      actions={<button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={13} /> New report</button>}>
      {err && <ErrBox msg={err} />}
      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <div className="card p-3 h-fit">
          {reports.length === 0 ? <p className="muted text-[13px] p-2">No reports yet. Generate your first executive brief or data-quality report.</p> : reports.map((r) => (
            <button key={r.id} onClick={() => setOpenId(r.id)} className={`w-full text-left rounded-lg px-3 py-2.5 mb-1 ${openId === r.id ? "text-white" : "hover:bg-black/5"}`} style={openId === r.id ? { background: "var(--brand)" } : {}}>
              <span className="font-bold text-[13px] block truncate">{r.name}</span>
              <span className="text-[11.5px] opacity-80 capitalize">{r.type.replace("_", " ")} · {fmtDateTime(r.updatedAt)}</span>
            </button>
          ))}
        </div>
        <div>
          {!open ? <Empty title="Select or create a report" body="The preview shows KPIs, trend, group breakdowns, evidence-backed insights and the data-quality section — ready to export." action={<button className="btn btn-primary" onClick={() => setShowNew(true)}>Generate report</button>} /> : (
            <div className="card p-5">
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <h2 className="font-extrabold text-[17px]">{open.name}</h2>
                <span className="badge b-slate capitalize">{open.type.replace("_", " ")}</span>
                <span className="ml-auto flex gap-1.5">
                  <button className="btn btn-ghost btn-sm" onClick={async () => { await post("/api/work", { resource: "reports", action: "regenerate", workspaceId: session.wsId, id: open.id, datasetId: open.datasetId, oldCommentary: open.content.commentary }); toast("Regenerated from current data"); load(); }}><RefreshCw size={12} /> Regenerate</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => exportCsv(open)}><Download size={12} /> CSV</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => exportXlsx(open)}><Download size={12} /> XLSX</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Printer size={12} /> Print / PDF</button>
                  <button className="btn btn-ghost btn-sm !text-red-600" onClick={() => setDeleteTarget(open)}><Trash2 size={12} /></button>
                </span>
              </div>
              <p className="muted text-[12px] mt-1">Dataset: {open.content.dataset} · Generated {open.content.generatedAt ? fmtDateTime(open.content.generatedAt) : ""} · {open.content.note}</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4">
                {(open.content.kpis || []).map((k: any) => <div key={k.label} className="rounded-[12px] p-3" style={{ background: "var(--surface2)" }}><p className="text-[10.5px] muted font-bold uppercase">{k.label}</p><p className="font-extrabold text-[18px]">{k.value}</p></div>)}
              </div>
              {open.content.trend?.length > 0 && <div className="mt-4"><p className="font-bold text-[13.5px] mb-1">{open.content.trendMetric} by month</p><Chart type="area" data={open.content.trend} /></div>}
              {open.content.groups?.length > 0 && <div className="mt-4"><p className="font-bold text-[13.5px] mb-1">Breakdown by {open.content.groupName}</p><DataTable data={open.content.groups} /></div>}
              {(open.content.insights || []).map((ins: any, i: number) => (
                <div key={i} className="mt-4 rounded-xl border p-3.5" style={{ borderColor: "var(--border)" }}>
                  <p className="font-semibold text-[13.5px]">{ins.answer}</p><p className="muted text-[12px] mt-1">Method: {ins.method}</p>
                </div>
              ))}
              {open.content.quality && <div className="mt-4"><p className="font-bold text-[13.5px]">Data quality — {open.content.quality.score}/100</p>
                <p className="muted text-[12px]">{open.content.quality.formula}</p>
                <div className="overflow-auto max-h-[220px] mt-2"><table className="data"><thead><tr><th>Issue</th><th>Severity</th><th>Count</th><th>Proposed</th></tr></thead>
                  <tbody>{open.content.quality.issues.map((i: any, idx: number) => <tr key={idx}><td>{i.problem}</td><td>{i.severity}</td><td>{i.count}</td><td>{i.proposed}</td></tr>)}</tbody></table></div></div>}
              <div className="mt-4 print:hidden">
                <label className="lbl">Your commentary</label>
                <textarea className="textarea" rows={3} value={commentaryDraft} onChange={(e) => setCommentaryDraft(e.target.value)} placeholder="Add context, decisions or caveats…" />
                <button className="btn btn-primary btn-sm mt-2" onClick={async () => { await post("/api/work", { resource: "reports", action: "update", workspaceId: session.wsId, id: open.id, commentary: commentaryDraft }); toast("Commentary saved"); load(); }}>Save commentary</button>
              </div>
              {open.content.commentary && <div className="mt-3 hidden print:block"><p className="font-bold text-[13px]">Commentary</p><p className="text-[13px]">{open.content.commentary}</p></div>}
            </div>
          )}
        </div>
      </div>
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Generate report">
        <div className="space-y-3">
          <div><label className="lbl">Report type</label><select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="lbl">Dataset</label><select className="select" value={form.datasetId} onChange={(e) => setForm({ ...form, datasetId: e.target.value })}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div><label className="lbl">Name (optional)</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Auto-generated" /></div>
          <div><label className="lbl">Commentary (optional)</label><textarea className="textarea" rows={2} value={form.commentary} onChange={(e) => setForm({ ...form, commentary: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button><button className="btn btn-primary" disabled={busy || !form.datasetId} onClick={create}><FileText size={14} /> Generate</button></div>
        </div>
      </Modal>
      <Confirm open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger title="Delete report?" body={`“${deleteTarget?.name}” will be deleted.`}
        onConfirm={async () => { await post("/api/work", { resource: "reports", action: "delete", workspaceId: session.wsId, id: deleteTarget.id }); setOpenId(""); load(); }} />
    </AppShell>
  );
}
