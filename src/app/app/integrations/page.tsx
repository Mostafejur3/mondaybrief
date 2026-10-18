"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, ErrBox, Modal, Confirm, fmtDateTime } from "@/components/ui";
import { Database, Globe, Import, Plug, Plus, Sheet, TestTube2, Trash2 } from "lucide-react";

const CATALOG = [
  { type: "postgresql", name: "PostgreSQL", icon: Database, desc: "Real connection test, schema inspection and table import. Use a read-only role.", ready: true },
  { type: "mysql", name: "MySQL", icon: Database, desc: "Connection form available. Live tests need the mysql2 driver (not bundled) — tests report this honestly.", ready: false },
  { type: "google_sheets", name: "Google Sheets", icon: Sheet, desc: "Save a sheet URL. Live authorization requires Google OAuth credentials via env.", ready: false },
  { type: "rest_api", name: "REST API endpoint", icon: Globe, desc: "Reachability test via HTTP GET against a base URL.", ready: true },
  { type: "shopify", name: "Shopify", icon: Plug, desc: "Roadmap connector — not available in this build; will never show as connected without a real test.", ready: false },
];

export default function Integrations() {
  const session = useSession(); const toast = useToast();
  const [list, setList] = useState<any[]>([]);
  const [err, setErr] = useState("");
  const [formType, setFormType] = useState<string>("");
  const [form, setForm] = useState<any>({ name: "", host: "", port: 5432, database: "", username: "", password: "", ssl: false, sheetUrl: "", baseUrl: "" });
  const [testing, setTesting] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [importFor, setImportFor] = useState<any>(null); // {integration, rows, table}

  const load = useCallback(async () => {
    if (!session.wsId) return;
    try { const d = await api(`/api/work?resource=integrations&workspaceId=${session.wsId}`); setList(d.integrations); }
    catch (e: any) { setErr(e.message); }
  }, [session.wsId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try { await post("/api/work", { resource: "integrations", action: "create", workspaceId: session.wsId, type: formType, ...form }); toast("Connection saved (secret encrypted server-side). Run a test to verify."); setFormType(""); load(); }
    catch (e: any) { toast(e.message, "error"); }
  };
  const test = async (i: any) => {
    setTesting(i.id);
    try { const r = await post("/api/work", { resource: "integrations", action: "test", workspaceId: session.wsId, id: i.id }); toast(`${i.name}: ${r.result.status} — ${r.result.message}`, r.result.status === "connected" ? "success" : "info"); await load(); }
    catch (e: any) { toast(e.message, "error"); } finally { setTesting(""); }
  };
  const previewTable = async (i: any, table: string) => {
    try { const r = await post("/api/work", { resource: "integrations", action: "previewTable", workspaceId: session.wsId, id: i.id, table }); setPreview({ table, rows: r.rows, columns: r.columns }); setImportFor({ integration: i, rows: r.rows, table }); }
    catch (e: any) { toast(e.message, "error"); }
  };
  const importTable = async () => {
    try { const d = await post("/api/datasets", { workspaceId: session.wsId, name: `${importFor.integration.name} · ${importFor.table}`, fileName: `db:${importFor.table}`, fileType: "postgresql", rows: importFor.rows }); toast(`Imported as dataset (quality ${d.dataset.qualityScore}/100)`); setPreview(null); }
    catch (e: any) { toast(e.message, "error"); }
  };

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  const canManage = ["owner", "admin"].includes(session.ws?.myRole || "");
  return (
    <AppShell session={session} title="Data Sources & Integrations" subtitle="A connector only becomes “connected” after a real test passes. Secrets are AES-256-GCM encrypted and never shown again. The app's own database credential is managed via server environment variables only.">
      {err && <ErrBox msg={err} />}
      {!canManage && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-[13px] px-4 py-3 mb-4">You are a {session.ws?.myRole} in this workspace — only owners/admins can add or test connections. Existing connections are listed read-only.</div>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5 mb-5">
        {CATALOG.map((c) => (
          <div key={c.type} className="card p-4">
            <div className="flex items-center gap-2"><c.icon size={18} className="text-emerald-600" /><b className="text-[14px]">{c.name}</b>
              <span className={`badge ml-auto ${c.ready ? "b-emerald" : "b-amber"}`}>{c.ready ? "Live tester" : "Needs credentials/driver"}</span></div>
            <p className="muted text-[12.5px] mt-1.5">{c.desc}</p>
            <button className="btn btn-ghost btn-sm mt-3" disabled={!canManage} onClick={() => { setFormType(c.type); setForm({ name: `My ${c.name}`, host: "", port: c.type === "mysql" ? 3306 : 5432, database: "", username: "", password: "", ssl: false, sheetUrl: "", baseUrl: "" }); }}><Plus size={12} /> Add connection</button>
          </div>
        ))}
      </div>

      <p className="font-extrabold text-[15px] mb-2.5">Configured connections</p>
      {list.length === 0 ? <div className="card p-6 text-center muted text-[13px]">No connections yet. Tip: you can test against this app's own PostgreSQL by using its host/credentials from your server environment (host 127.0.0.1, port 5432) — with a read-only role you create for analytics.</div> : (
        <div className="space-y-3">{list.map((i) => (
          <div key={i.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <b>{i.name}</b><span className="badge b-slate capitalize">{i.type.replace("_", " ")}</span>
              <span className={`badge ${i.status === "connected" ? "b-emerald" : i.status === "failed" ? "b-red" : "b-amber"}`}>{i.status.replace("_", " ")}</span>
              {i.config?.host && <span className="muted text-[12px]">{i.config.username}@{i.config.host}:{i.config.port}/{i.config.database} · secret {i.hasSecret ? "stored (encrypted)" : "not set"}</span>}
              <span className="ml-auto flex gap-1.5">
                <button className="btn btn-primary btn-sm" disabled={testing === i.id || !canManage} onClick={() => test(i)}><TestTube2 size={12} />{testing === i.id ? "Testing…" : "Test connection"}</button>
                <button className="btn btn-ghost btn-sm !text-red-600" disabled={!canManage} onClick={() => setDeleteTarget(i)}><Trash2 size={13} /></button>
              </span>
            </div>
            {i.lastTestAt && <p className="text-[12.5px] mt-2"><b>Last test</b> {fmtDateTime(i.lastTestAt)} · {i.lastTest?.ms} ms · {i.lastTest?.message}{i.lastTest?.next && <><br /><span className="muted">Next step: {i.lastTest.next}</span></>}</p>}
            {i.lastTest?.tables?.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{i.lastTest.tables.map((t: string) => <button key={t} className="btn btn-ghost btn-sm" onClick={() => previewTable(i, t)}>{t} — preview</button>)}</div>}
          </div>
        ))}</div>
      )}

      <Modal open={!!formType} onClose={() => setFormType("")} title={`Add ${CATALOG.find((c) => c.type === formType)?.name || ""} connection`}>
        <div className="space-y-3">
          <div><label className="lbl">Display name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          {(formType === "postgresql" || formType === "mysql") && <>
            <div className="grid grid-cols-[2fr_1fr] gap-3"><div><label className="lbl">Host</label><input className="input" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="db.example.com" /></div>
              <div><label className="lbl">Port</label><input className="input" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="lbl">Database</label><input className="input" value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })} /></div>
              <div><label className="lbl">Username (read-only role recommended)</label><input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div></div>
            <div><label className="lbl">Password (encrypted at rest, never shown again)</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></div>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={form.ssl} onChange={(e) => setForm({ ...form, ssl: e.target.checked })} /> Use SSL/TLS</label>
          </>}
          {formType === "google_sheets" && <div><label className="lbl">Google Sheet URL</label><input className="input" value={form.sheetUrl} onChange={(e) => setForm({ ...form, sheetUrl: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…" /><p className="muted text-[12px] mt-1">Live read requires GOOGLE_CLIENT_ID/SECRET on the server. Until then tests report “incomplete” — honestly.</p></div>}
          {formType === "rest_api" && <div><label className="lbl">Base URL</label><input className="input" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.example.com/health" /></div>}
          {(formType === "shopify") && <p className="muted text-[13px]">This connector is on the roadmap. Saving records your intent only; no connection test exists yet, so it will stay “not tested”.</p>}
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setFormType("")}>Cancel</button><button className="btn btn-primary" onClick={create}>Save connection</button></div>
        </div>
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Table preview — ${preview?.table} (max 1,000 rows, read-only)`} wide>
        {preview && <>
          <p className="muted text-[12.5px] mb-2">{preview.rows.length} rows · {preview.columns.length} columns: {preview.columns.join(", ")}</p>
          <div className="overflow-auto max-h-[300px] rounded-lg border" style={{ borderColor: "var(--border)" }}><table className="data"><thead><tr>{preview.columns.map((c: string) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{preview.rows.slice(0, 10).map((r: any, i: number) => <tr key={i}>{preview.columns.map((c: string) => <td key={c}>{String(r[c] ?? "")}</td>)}</tr>)}</tbody></table></div>
          <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost" onClick={() => setPreview(null)}>Close</button>
            <button className="btn btn-primary" onClick={importTable}><Import size={14} /> Import as dataset</button></div>
        </>}
      </Modal>
      <Confirm open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger title="Delete connection?" body={`“${deleteTarget?.name}” and its encrypted secret will be permanently deleted.`}
        onConfirm={async () => { await post("/api/work", { resource: "integrations", action: "delete", workspaceId: session.wsId, id: deleteTarget.id }); load(); }} />
    </AppShell>
  );
}
