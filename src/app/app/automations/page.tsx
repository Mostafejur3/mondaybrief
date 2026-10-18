"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, ErrBox, Modal, Confirm, sevBadge, fmtDateTime } from "@/components/ui";
import { BellRing, Play, Plus, Trash2, Workflow } from "lucide-react";

const STEP_TYPES = [["validate", "Validate dataset & recompute quality"], ["recipe", "Apply bound cleaning recipe"], ["report", "Generate snapshot report"], ["checkAlerts", "Evaluate alerts"], ["notify", "Notify me (in-app)"]] as const;

export default function Automations() {
  const session = useSession(); const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [err, setErr] = useState(""); const [busyId, setBusyId] = useState("");
  const [tab, setTab] = useState<"workflows" | "alerts">("workflows");
  const [showNew, setShowNew] = useState(false); const [showAlert, setShowAlert] = useState(false);
  const [form, setForm] = useState({ name: "", datasetId: "", recipeId: "", schedule: "manual", steps: ["validate", "notify"] as string[] });
  const [alertForm, setAlertForm] = useState({ name: "", datasetId: "", metric: "__quality__", agg: "sum", operator: "<", threshold: 80, severity: "medium" });
  const [metrics, setMetrics] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null); const [deleteKind, setDeleteKind] = useState("");

  const load = useCallback(async () => {
    if (!session.wsId) return;
    try {
      const d = await api(`/api/work?resource=automations&workspaceId=${session.wsId}`); setData(d);
      const ds = await api(`/api/datasets?workspaceId=${session.wsId}`); const active = ds.datasets.filter((x: any) => x.status === "active");
      setDatasets(active);
      setForm((f) => ({ ...f, datasetId: f.datasetId || active[0]?.id || "" }));
      setAlertForm((f) => ({ ...f, datasetId: f.datasetId || active[0]?.id || "" }));
    } catch (e: any) { setErr(e.message); }
  }, [session.wsId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!alertForm.datasetId) return;
    api(`/api/datasets/${alertForm.datasetId}?view=analysis`).then((d) => setMetrics((d.columns || []))).catch(() => {});
  }, [alertForm.datasetId]);

  const run = async (a: any) => {
    setBusyId(a.id);
    try { const r = await post("/api/work", { resource: "automations", action: "run", workspaceId: session.wsId, id: a.id }); toast(`Run ${r.run.status}`); await load(); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusyId(""); }
  };
  const evaluate = async (a: any) => {
    try { const r = await post("/api/work", { resource: "alerts", action: "evaluate", workspaceId: session.wsId, id: a.id }); toast(r.triggered ? `Triggered! Current value ${r.value}` : `Not triggered. Current value ${r.value}`, r.triggered ? "info" : "success"); load(); }
    catch (e: any) { toast(e.message, "error"); }
  };

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  return (
    <AppShell session={session} title="Automations & Smart Alerts" subtitle="Workflows run immediately with “Run now” and are fully logged. Schedules are persisted — a production worker/cron executes timed runs (we never pretend a browser tab is a scheduler)."
      actions={<>
        <button className="btn btn-ghost btn-sm" onClick={() => { setTab("alerts"); setShowAlert(true); }}><BellRing size={13} /> New alert</button>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={13} /> New workflow</button>
      </>}>
      {err && <ErrBox msg={err} />}
      <div className="flex gap-1.5 mb-3">
        <button onClick={() => setTab("workflows")} className={`btn btn-sm ${tab === "workflows" ? "btn-primary" : "btn-ghost"}`}><Workflow size={13} /> Workflows ({data?.automations.length || 0})</button>
        <button onClick={() => setTab("alerts")} className={`btn btn-sm ${tab === "alerts" ? "btn-primary" : "btn-ghost"}`}><BellRing size={13} /> Alerts ({data?.alerts.length || 0})</button>
      </div>
      {!data ? <Spinner /> : tab === "workflows" ? (
        <div className="space-y-3">
          {data.automations.length === 0 && <div className="card p-8 text-center muted text-[13px]">No workflows yet. Example: validate the weekly export → apply the saved cleaning recipe → snapshot a report → notify you.</div>}
          {data.automations.map((a: any) => (
            <div key={a.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-[14px]">{a.name}</b>
                <span className="badge b-slate capitalize">{a.schedule}</span>
                <span className={`badge ${a.enabled ? "b-emerald" : "b-slate"}`}>{a.enabled ? "enabled" : "disabled"}</span>
                <span className="muted text-[12px]">Last run: {a.lastRunAt ? fmtDateTime(a.lastRunAt) : "never"}</span>
                <span className="ml-auto flex gap-1.5">
                  <button className="btn btn-primary btn-sm" disabled={busyId === a.id} onClick={() => run(a)}><Play size={12} />{busyId === a.id ? "Running…" : "Run now"}</button>
                  <button className="btn btn-ghost btn-sm" onClick={async () => { await post("/api/work", { resource: "automations", action: "toggle", workspaceId: session.wsId, id: a.id, enabled: !a.enabled }); load(); }}>{a.enabled ? "Disable" : "Enable"}</button>
                  <button className="btn btn-ghost btn-sm !text-red-600" onClick={() => { setDeleteTarget(a); setDeleteKind("automations"); }}><Trash2 size={13} /></button>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2.5">{(a.steps || []).map((s: any, i: number) => <span key={i} className="badge b-blue">{i + 1}. {s.label || s.type}</span>)}</div>
              {(a.runs || []).length > 0 && <details className="mt-3"><summary className="text-[12.5px] font-bold cursor-pointer">Run history ({a.runs.length})</summary>
                {a.runs.map((r: any) => <div key={r.id} className="mt-2 rounded-lg p-2.5 text-[12px]" style={{ background: "var(--surface2)" }}>
                  <span className={`badge ${r.status === "completed" ? "b-emerald" : "b-red"}`}>{r.status}</span> <span className="muted">{fmtDateTime(r.startedAt)}</span>
                  <ul className="list-disc ml-5 mt-1.5">{(r.log || []).map((l: string, i: number) => <li key={i}>{l}</li>)}</ul></div>)}
              </details>}
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="data">
          <thead><tr><th>Alert</th><th>Condition</th><th>Severity</th><th>Last value</th><th>Triggered</th><th>Status</th><th className="!text-right">Actions</th></tr></thead>
          <tbody>{data.alerts.length === 0 ? <tr><td colSpan={7} className="text-center muted py-6">No alerts. Create one — e.g. “quality score &lt; 80” or “sum(Revenue) &lt; 5000”.</td></tr> : data.alerts.map((a: any) => (
            <tr key={a.id}><td className="font-semibold">{a.name}</td>
              <td>{a.metric === "__quality__" ? "Quality score" : `${a.agg}(${a.metric})`} {a.operator} {a.threshold}</td>
              <td><span className={`badge ${sevBadge(a.severity)}`}>{a.severity}</span></td>
              <td>{a.lastValue || "—"}</td><td>{a.lastTriggeredAt ? fmtDateTime(a.lastTriggeredAt) : "never"}</td>
              <td><span className={`badge ${a.enabled ? "b-emerald" : "b-slate"}`}>{a.enabled ? "on" : "off"}</span></td>
              <td className="!text-right"><button className="btn btn-primary btn-sm" onClick={() => evaluate(a)}>Evaluate now</button>{" "}
                <button className="btn btn-ghost btn-sm" onClick={async () => { await post("/api/work", { resource: "alerts", action: "toggle", workspaceId: session.wsId, id: a.id, enabled: !a.enabled }); load(); }}>{a.enabled ? "Off" : "On"}</button>{" "}
                <button className="btn btn-ghost btn-sm !text-red-600" onClick={() => { setDeleteTarget(a); setDeleteKind("alerts"); }}><Trash2 size={13} /></button></td></tr>
          ))}</tbody></table></div></div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New workflow">
        <div className="space-y-3">
          <div><label className="lbl">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weekly orders pipeline" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl">Dataset</label><select className="select" value={form.datasetId} onChange={(e) => setForm({ ...form, datasetId: e.target.value })}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="lbl">Schedule (stored for production worker)</label><select className="select" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}>{["manual", "daily", "weekly", "monthly"].map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="lbl">Cleaning recipe (for the recipe step)</label><select className="select" value={form.recipeId} onChange={(e) => setForm({ ...form, recipeId: e.target.value })}><option value="">— none —</option>{(data?.recipes || []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
          <div><label className="lbl">Steps (executed in this order)</label>
            {STEP_TYPES.map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-[13px] py-1"><input type="checkbox" checked={form.steps.includes(v)} onChange={(e) => setForm({ ...form, steps: e.target.checked ? [...form.steps, v] : form.steps.filter((s) => s !== v) })} />{l}</label>
            ))}</div>
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => { try { await post("/api/work", { resource: "automations", action: "create", workspaceId: session.wsId, name: form.name || "Workflow", datasetId: form.datasetId, recipeId: form.recipeId || null, schedule: form.schedule, steps: STEP_TYPES.filter(([v]) => form.steps.includes(v)).map(([type, label]) => ({ type, label })) }); toast("Workflow created"); setShowNew(false); load(); } catch (e: any) { toast(e.message, "error"); } }}>Create workflow</button></div>
        </div>
      </Modal>

      <Modal open={showAlert} onClose={() => setShowAlert(false)} title="New alert">
        <div className="space-y-3">
          <div><label className="lbl">Name</label><input className="input" value={alertForm.name} onChange={(e) => setAlertForm({ ...alertForm, name: e.target.value })} placeholder="e.g. Data quality drop" /></div>
          <div><label className="lbl">Dataset</label><select className="select" value={alertForm.datasetId} onChange={(e) => setAlertForm({ ...alertForm, datasetId: e.target.value })}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="grid grid-cols-3 gap-2.5">
            <div><label className="lbl">Metric</label><select className="select" value={alertForm.metric} onChange={(e) => setAlertForm({ ...alertForm, metric: e.target.value })}><option value="__quality__">Quality score</option>{metrics.map((m) => <option key={m}>{m}</option>)}</select></div>
            <div><label className="lbl">Aggregation</label><select className="select" value={alertForm.agg} onChange={(e) => setAlertForm({ ...alertForm, agg: e.target.value })}>{["sum", "avg", "count", "min", "max"].map((a) => <option key={a}>{a}</option>)}</select></div>
            <div><label className="lbl">Severity</label><select className="select" value={alertForm.severity} onChange={(e) => setAlertForm({ ...alertForm, severity: e.target.value })}>{["high", "medium", "low"].map((a) => <option key={a}>{a}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div><label className="lbl">Condition</label><select className="select" value={alertForm.operator} onChange={(e) => setAlertForm({ ...alertForm, operator: e.target.value })}><option value="<">below (&lt;)</option><option value=">">above (&gt;)</option><option value="==">equal to</option></select></div>
            <div><label className="lbl">Threshold</label><input className="input" type="number" value={alertForm.threshold} onChange={(e) => setAlertForm({ ...alertForm, threshold: Number(e.target.value) })} /></div>
          </div>
          <p className="muted text-[12px]">Alerts are evaluated when you (or a workflow) run them in this runtime; triggers create an in-app notification. Email/SMS channels activate with a configured provider.</p>
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setShowAlert(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => { try { await post("/api/work", { resource: "alerts", action: "create", workspaceId: session.wsId, ...alertForm }); toast("Alert created"); setShowAlert(false); load(); } catch (e: any) { toast(e.message, "error"); } }}>Create alert</button></div>
        </div>
      </Modal>
      <Confirm open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger title="Delete this item?" body={`“${deleteTarget?.name}” will be permanently deleted.`}
        onConfirm={async () => { await post("/api/work", { resource: deleteKind, action: "delete", workspaceId: session.wsId, id: deleteTarget.id }); load(); }} />
    </AppShell>
  );
}
