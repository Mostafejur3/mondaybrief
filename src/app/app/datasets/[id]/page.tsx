"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { Studio } from "@/components/studio";
import { api, post, useToast, Spinner, ErrBox, Modal, download, rowsToCsv } from "@/components/ui";
import { BarChart3, Download, FileText, Gauge, Save } from "lucide-react";
import * as XLSX from "xlsx";

export default function DatasetPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession(); const toast = useToast(); const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [recipeName, setRecipeName] = useState(""); const [showRecipe, setShowRecipe] = useState(false);
  const [template, setTemplate] = useState("executive");

  const load = useCallback(async () => {
    try { setData(await api(`/api/datasets/${id}`)); } catch (e: any) { setErr(e.message); }
  }, [id]);
  useEffect(() => { if (session.user) load(); }, [load, session.user]);

  const apply = async (op: string, params: any) => {
    setBusy(true);
    try { await post(`/api/datasets/${id}`, { action: "apply", op, params }); await load(); }
    finally { setBusy(false); }
  };
  const revert = async (opId: string) => {
    setBusy(true);
    try { await post(`/api/datasets/${id}`, { action: "revert", opId }); toast("Reverted to the snapshot taken before that operation"); await load(); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const makeDashboard = async () => {
    try { const r = await post(`/api/datasets/${id}`, { action: "createDashboard", template, name: `${data.dataset.name} — ${template} dashboard` }); toast("Dashboard created from template"); router.push(`/app/dashboards/${r.dashboard.id}`); }
    catch (e: any) { toast(e.message, "error"); }
  };

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  if (err) return <AppShell session={session} title="Dataset"><ErrBox msg={err} /><Link href="/app/data" className="btn btn-ghost btn-sm mt-3">Back to Data Hub</Link></AppShell>;
  if (!data) return <AppShell session={session} title="Loading dataset…"><Spinner /></AppShell>;

  const ds = data.dataset;
  return (
    <AppShell session={session} title={ds.name}
      subtitle={`Cleaning Studio · ${data.rows.length.toLocaleString()} rows × ${data.columns.length} columns · quality ${data.quality.score}/100 · originals preserved via revert snapshots. Breadcrumb: Data Hub / ${ds.name}`}
      actions={<>
        <button className="btn btn-ghost btn-sm" onClick={() => download(`${ds.name}.csv`, rowsToCsv(data.rows, data.columns))}><Download size={13} /> CSV</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { const ws = XLSX.utils.json_to_sheet(data.rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Cleaned"); XLSX.writeFile(wb, `${ds.name}.xlsx`); }}><Download size={13} /> XLSX</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowRecipe(true)}><Save size={13} /> Save recipe</button>
        <Link href={`/app/analysis?dataset=${id}`} className="btn btn-ghost btn-sm"><BarChart3 size={13} /> Analyze</Link>
        <Link href={`/app/reports?dataset=${id}`} className="btn btn-ghost btn-sm"><FileText size={13} /> Report</Link>
        <select className="select !w-[150px] !py-1.5 text-[12.5px]" value={template} onChange={(e) => setTemplate(e.target.value)} aria-label="Dashboard template">
          {["executive", "sales", "finance", "ecommerce", "operations"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)} template</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={makeDashboard}><Gauge size={13} /> Build dashboard</button>
      </>}>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {["Inspect", "Review issues", "Choose operations", "Preview changes", "Apply", "Validate", "Compare before/after", "Save recipe", "Export / Analyze"].map((s, i) => (
          <span key={s} className="badge b-slate !py-1"><b className="text-emerald-700 dark:text-emerald-400">{i + 1}</b> {s}</span>
        ))}
      </div>
      <Studio rows={data.rows} columns={data.columns} onApply={apply} busy={busy} history={data.history || []} onRevert={revert} />
      {(data.recipes || []).length > 0 && (
        <div className="card p-4 mt-4">
          <p className="font-bold text-[13.5px] mb-2">Saved cleaning recipes (workspace)</p>
          <div className="flex flex-wrap gap-2">{data.recipes.map((r: any) => (
            <span key={r.id} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12.5px]" style={{ borderColor: "var(--border)" }}>
              <b>{r.name}</b><span className="muted">{(r.steps || []).length} steps</span>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={async () => { try { await post(`/api/datasets/${id}`, { action: "applyRecipe", recipeId: r.id }); toast(`Recipe “${r.name}” applied`); await load(); } catch (e: any) { toast(e.message, "error"); } }}>Apply to this dataset</button>
            </span>))}</div>
        </div>
      )}
      <Modal open={showRecipe} onClose={() => setShowRecipe(false)} title="Save cleaning recipe">
        <p className="muted text-[13px] mb-3">Saves the sequence of applied operations on this dataset so you can replay it on future files (and inside automations).</p>
        <label className="lbl">Recipe name</label><input className="input" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="e.g. Weekly orders cleanup" />
        <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost" onClick={() => setShowRecipe(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={async () => { try { await post(`/api/datasets/${id}`, { action: "saveRecipe", name: recipeName || "Cleaning recipe" }); toast("Recipe saved"); setShowRecipe(false); await load(); } catch (e: any) { toast(e.message, "error"); } }}>Save recipe</button></div>
      </Modal>
    </AppShell>
  );
}
