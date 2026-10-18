"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { WidgetCard, THEMES, applyFilters } from "@/components/dashboardView";
import { api, post, useToast, Spinner, ErrBox, Modal, Confirm, download, rowsToCsv } from "@/components/ui";
import { ArrowDown, ArrowUp, Download, GripVertical, History, Pencil, Plus, Printer, Save, Trash2 } from "lucide-react";

const WIDGET_TYPES = ["kpi", "bar", "line", "area", "donut", "pie", "histogram", "funnel", "scatter", "table", "text"];

export default function Builder() {
  const { id } = useParams<{ id: string }>();
  const session = useSession(); const toast = useToast();
  const [dash, setDash] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [err, setErr] = useState(""); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<any[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const dragIdx = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!session.wsId) return;
    try {
      const d = await api(`/api/work?resource=dashboards&workspaceId=${session.wsId}&id=${id}`);
      if (!d.dashboard) { setErr("Dashboard not found in this workspace."); return; }
      setDash(d.dashboard); setRows(d.rows || []); setCols(d.columns || []);
      const ds = await api(`/api/datasets?workspaceId=${session.wsId}`); setDatasets(ds.datasets);
    } catch (e: any) { setErr(e.message); }
  }, [session.wsId, id]);
  useEffect(() => { load(); }, [load]);

  const config = dash?.config || { theme: "emerald", widgets: [] };
  const widgets: any[] = config.widgets || [];
  const theme = THEMES[config.theme] || THEMES.emerald;
  const filtered = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const filterDims = useMemo(() => cols.filter((c) => new Set(rows.map((r) => String(r[c] ?? "").trim())).size <= 25).slice(0, 4), [cols, rows]);

  const setWidgets = (w: any[]) => { setDash({ ...dash, config: { ...config, widgets: w } }); setDirty(true); };
  const save = async () => {
    setBusy(true);
    try { await post("/api/work", { resource: "dashboards", action: "update", workspaceId: session.wsId, id, name: dash.name, description: dash.description, datasetId: dash.datasetId, config: dash.config }); toast("Dashboard saved (previous version kept in history)"); setDirty(false); await load(); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const addWidget = () => setEditing({ id: Math.random().toString(36).slice(2, 9), type: "bar", title: "New widget", metric: cols[0] || "", dimension: cols[1] || cols[0] || "", agg: "sum", width: 6, color: theme.color, text: "" });
  const persistWidget = () => {
    const exists = widgets.some((w) => w.id === editing.id);
    setWidgets(exists ? widgets.map((w) => w.id === editing.id ? editing : w) : [...widgets, editing]);
    setEditing(null);
  };
  const move = (i: number, dir: number) => { const w = [...widgets]; const j = i + dir; if (j < 0 || j >= w.length) return; [w[i], w[j]] = [w[j], w[i]]; setWidgets(w); };
  const onDrop = (j: number) => { const i = dragIdx.current; if (i === null || i === j) return; const w = [...widgets]; const [m] = w.splice(i, 1); w.splice(j, 0, m); setWidgets(w); dragIdx.current = null; };
  const changeDataset = async (dsId: string) => { setDash({ ...dash, datasetId: dsId }); setDirty(true); try { const d = await api(`/api/datasets/${dsId}`); setRows(d.rows); setCols(d.columns); } catch {} };
  const loadVersions = async () => { const r = await post("/api/work", { resource: "dashboards", action: "versions", workspaceId: session.wsId, id }); setVersions(r.versions); };

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  return (
    <AppShell session={session} title={dash ? dash.name : "Dashboard builder"} subtitle="Drag cards by their handle to rearrange. Click a chart segment to cross-filter everything. Save persists layout + config; every save keeps a restorable version."
      actions={dash && <>
        <button className="btn btn-ghost btn-sm" onClick={() => download(`${dash.name}-data.csv`, rowsToCsv(filtered, cols))}><Download size={13} /> Data CSV</button>
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Printer size={13} /> Print / PDF</button>
        <button className="btn btn-ghost btn-sm" onClick={loadVersions}><History size={13} /> Versions</button>
        <button className="btn btn-ghost btn-sm" onClick={addWidget}><Plus size={13} /> Add widget</button>
        <button className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={save}><Save size={13} /> {dirty ? "Save changes" : "Saved"}</button>
      </>}>
      {err && <ErrBox msg={err} />}
      {!dash ? (!err && <Spinner />) : (
        <div className="space-y-3.5">
          <div className="card p-3 grid md:grid-cols-4 gap-2.5 print:hidden">
            <div><label className="lbl">Dashboard name</label><input className="input" value={dash.name} onChange={(e) => { setDash({ ...dash, name: e.target.value }); setDirty(true); }} /></div>
            <div><label className="lbl">Description</label><input className="input" value={dash.description || ""} onChange={(e) => { setDash({ ...dash, description: e.target.value }); setDirty(true); }} placeholder="What is this dashboard for?" /></div>
            <div><label className="lbl">Data source</label><select className="select" value={dash.datasetId || ""} onChange={(e) => changeDataset(e.target.value)}><option value="">— none bound —</option>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="lbl">Theme preset</label><select className="select" value={config.theme} onChange={(e) => { setDash({ ...dash, config: { ...config, theme: e.target.value } }); setDirty(true); }}>{Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}</select></div>
          </div>

          {filterDims.length > 0 && (
            <div className="card p-3 flex flex-wrap gap-2.5 items-end print:hidden">
              <span className="font-bold text-[12.5px]">Global filters</span>
              {filterDims.map((dim) => {
                const values = [...new Set(rows.map((r) => String(r[dim] ?? "").trim()).filter(Boolean))].sort();
                return <div key={dim}><label className="lbl">{dim}</label><select className="select !w-[160px]" value={filters[dim] || ""} onChange={(e) => setFilters({ ...filters, [dim]: e.target.value })}><option value="">All</option>{values.map((v) => <option key={v}>{v}</option>)}</select></div>;
              })}
              {Object.values(filters).some(Boolean) && <button className="btn btn-ghost btn-sm" onClick={() => setFilters({})}>Clear all</button>}
              <span className="muted text-[12px] ml-auto">{filtered.length} of {rows.length} rows</span>
            </div>
          )}

          <div className="rounded-2xl p-3.5 border" style={{ background: config.theme === "midnight" ? theme.bg : "transparent", borderColor: "var(--border)", color: config.theme === "midnight" ? "#dbeafe" : undefined }}>
            {widgets.length === 0 ? <p className="text-center muted text-[13px] py-8">No widgets yet — click “Add widget” to place your first KPI, chart, table or note.</p> : (
              <div className="grid grid-cols-12 gap-3">
                {widgets.map((w, i) => {
                  const span = w.width >= 10 ? "col-span-12" : w.width >= 5 ? "col-span-12 md:col-span-6" : w.width >= 4 ? "col-span-12 sm:col-span-6 xl:col-span-4" : "col-span-6 xl:col-span-3";
                  return (
                    <div key={w.id} className={span} draggable onDragStart={() => (dragIdx.current = i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)}>
                      <WidgetCard widget={w} rows={filtered} theme={config.theme}
                        onSelect={w.dimension ? (label) => setFilters({ ...filters, [w.dimension]: label }) : undefined}
                        footer={<div className="flex items-center gap-1 mt-2 pt-2 border-t print:hidden" style={{ borderColor: "var(--border)" }}>
                          <GripVertical size={14} className="muted cursor-grab" />
                          <button className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} title="Move earlier"><ArrowUp size={12} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} title="Move later"><ArrowDown size={12} /></button>
                          <select className="select !w-[86px] !py-1 text-[12px]" value={w.width} onChange={(e) => setWidgets(widgets.map((x) => x.id === w.id ? { ...x, width: Number(e.target.value) } : x))} aria-label="Widget width">{[3, 4, 6, 8, 12].map((n) => <option key={n} value={n}>{n}/12 wide</option>)}</select>
                          <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setEditing({ ...w })}><Pencil size={12} /> Edit</button>
                          <button className="btn btn-ghost btn-sm !text-red-600" onClick={() => setConfirmDelete(w)}><Trash2 size={12} /></button>
                        </div>} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="muted text-[12px] print:hidden">Breadcrumb: <Link href="/app/dashboards" className="link">Dashboards</Link> / {dash.name} · v{dash.version}{dirty ? " · unsaved changes" : ""}</p>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Widget settings">
        {editing && <div className="space-y-3">
          <div><label className="lbl">Title</label><input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl">Type</label><select className="select" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>{WIDGET_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className="lbl">Aggregation</label><select className="select" value={editing.agg} onChange={(e) => setEditing({ ...editing, agg: e.target.value })}>{["sum", "avg", "count", "min", "max", "quality", "margin"].map((a) => <option key={a}>{a}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl">Metric column</label><select className="select" value={editing.metric} onChange={(e) => setEditing({ ...editing, metric: e.target.value })}>{cols.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="lbl">Dimension column</label><select className="select" value={editing.dimension} onChange={(e) => setEditing({ ...editing, dimension: e.target.value })}>{cols.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl">Color</label><input type="color" className="input !h-[38px]" value={editing.color || "#059669"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></div>
            <div><label className="lbl">Time series (monthly)</label><select className="select" value={editing.time ? "yes" : "no"} onChange={(e) => setEditing({ ...editing, time: e.target.value === "yes" })}><option value="no">No — group by dimension</option><option value="yes">Yes — by month (date column auto-detected)</option></select></div>
          </div>
          {editing.type === "text" && <div><label className="lbl">Note text</label><textarea className="textarea" rows={3} value={editing.text || ""} onChange={(e) => setEditing({ ...editing, text: e.target.value })} /></div>}
          <div><label className="lbl">Explanatory note (optional)</label><input className="input" value={editing.note || ""} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="e.g. Excludes refunded orders" /></div>
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={persistWidget}>Apply widget</button></div>
        </div>}
      </Modal>

      <Modal open={!!versions} onClose={() => setVersions(null)} title="Version history">
        {!versions?.length ? <p className="muted text-[13px]">No previous versions yet. Each save archives the prior configuration here.</p> : (
          <div className="space-y-2">{versions.map((v) => (
            <div key={v.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: "var(--border)" }}>
              <span>Version {v.version} · {new Date(v.createdAt).toLocaleString()} · {(v.config?.widgets || []).length} widgets</span>
              <button className="btn btn-ghost btn-sm ml-auto" onClick={async () => { await post("/api/work", { resource: "dashboards", action: "restore", workspaceId: session.wsId, versionId: v.id }); toast("Version restored"); setVersions(null); load(); }}>Restore</button>
            </div>))}</div>
        )}
      </Modal>
      <Confirm open={!!confirmDelete} onClose={() => setConfirmDelete(null)} danger title="Remove widget?" body={`“${confirmDelete?.title}” will be removed from this dashboard (recoverable via version history after saving).`}
        onConfirm={() => setWidgets(widgets.filter((w) => w.id !== confirmDelete.id))} />
    </AppShell>
  );
}
