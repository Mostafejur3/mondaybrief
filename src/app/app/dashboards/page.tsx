"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, ErrBox, Modal, Confirm, Empty, fmtDateTime } from "@/components/ui";
import { Copy, Gauge, Plus, Search, Trash2 } from "lucide-react";

const TEMPLATES = [
  ["executive", "Executive overview", "Headline KPIs, trend, category share and quality at a glance."],
  ["sales", "Sales performance", "Revenue trend, top products, share and regional table."],
  ["finance", "Revenue & profitability", "Revenue vs cost, margin % and profitability by segment."],
  ["ecommerce", "E-commerce analytics", "Orders, AOV, top products and status funnel."],
  ["operations", "Inventory & operations", "Volumes, status mix, distributions and summaries."],
  ["blank", "Blank dashboard", "Start empty and add your own widgets."],
];
export default function Dashboards() {
  const session = useSession(); const toast = useToast();
  const [list, setList] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [err, setErr] = useState(""); const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [template, setTemplate] = useState("executive"); const [dsId, setDsId] = useState(""); const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const load = useCallback(async () => {
    if (!session.wsId) return;
    try { const d = await api(`/api/work?resource=dashboards&workspaceId=${session.wsId}`); setList(d.dashboards);
      const ds = await api(`/api/datasets?workspaceId=${session.wsId}`); setDatasets(ds.datasets.filter((x: any) => x.status === "active")); setDsId(ds.datasets.find((x: any) => x.status === "active")?.id || "");
    } catch (e: any) { setErr(e.message); }
  }, [session.wsId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try { const r = await post("/api/work", { resource: "dashboards", action: "create", workspaceId: session.wsId, datasetId: dsId, name: name || `${template[0].toUpperCase() + template.slice(1)} dashboard`, template: template === "blank" ? undefined : template, widgets: template === "blank" ? [] : undefined }); toast("Dashboard created"); setShowNew(false); load(); window.location.href = `/app/dashboards/${r.dashboard.id}`; }
    catch (e: any) { toast(e.message, "error"); }
  };
  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  const filtered = list.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <AppShell session={session} title="Dashboards" subtitle="Layouts, widget configs and themes persist in the database. Open one to edit with drag & drop, resize, filters and version history."
      actions={<button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={13} /> New dashboard</button>}>
      {err && <ErrBox msg={err} />}
      <div className="relative mb-3 w-[260px]"><Search size={14} className="absolute left-2.5 top-[9px] muted" /><input className="input pl-8" placeholder="Search dashboards…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {filtered.length === 0 ? <Empty title="No dashboards yet" body="Create one from a template (widgets are auto-mapped to your dataset's columns) or start blank." action={<button className="btn btn-primary" onClick={() => setShowNew(true)}>Create dashboard</button>} /> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filtered.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex items-start gap-2"><Gauge size={18} className="text-emerald-600 mt-0.5" />
                <div className="flex-1 min-w-0"><Link href={`/app/dashboards/${d.id}`} className="font-bold text-[14.5px] hover:underline block truncate">{d.name}</Link>
                  <p className="muted text-[12px] truncate">{d.description || "No description"}</p></div>
                <span className="badge b-slate">v{d.version}</span></div>
              <p className="muted text-[12px] mt-2.5">{((d.config as any)?.widgets || []).length} widgets · theme {(d.config as any)?.theme || "emerald"} · updated {fmtDateTime(d.updatedAt)}</p>
              <div className="flex gap-1.5 mt-3">
                <Link href={`/app/dashboards/${d.id}`} className="btn btn-primary btn-sm">Open builder</Link>
                <button className="btn btn-ghost btn-sm" onClick={async () => { await post("/api/work", { resource: "dashboards", action: "duplicate", workspaceId: session.wsId, id: d.id }); toast("Duplicated"); load(); }}><Copy size={12} /> Duplicate</button>
                <button className="btn btn-ghost btn-sm !text-red-600 ml-auto" onClick={() => setDeleteTarget(d)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New dashboard" wide>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-3">
            <div><label className="lbl">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 Sales" /></div>
            <div><label className="lbl">Dataset</label><select className="select" value={dsId} onChange={(e) => setDsId(e.target.value)}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{!datasets.length && <p className="muted text-[12px] mt-1">No active datasets — import one first; a blank dashboard can bind later.</p>}</div>
          </div>
          <div><label className="lbl">Template</label>
            <div className="space-y-1.5">{TEMPLATES.map(([id, t, b]) => (
              <button key={id} onClick={() => setTemplate(id)} className={`w-full text-left rounded-lg border px-3 py-2 ${template === id ? "ring-2 ring-emerald-500" : ""}`} style={{ borderColor: "var(--border)" }}>
                <span className="font-bold text-[13px] block">{t}</span><span className="muted text-[11.5px]">{b}</span></button>))}
            </div></div>
        </div>
        <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button><button className="btn btn-primary" onClick={create}>Create dashboard</button></div>
      </Modal>
      <Confirm open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger title="Delete dashboard?" body={`“${deleteTarget?.name}” and its version history will be deleted. The underlying dataset is unaffected.`}
        onConfirm={async () => { await post("/api/work", { resource: "dashboards", action: "delete", workspaceId: session.wsId, id: deleteTarget.id }); load(); }} />
    </AppShell>
  );
}
