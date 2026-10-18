"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { AnswerCard } from "@/components/answerCard";
import { api, post, useToast, Spinner, ErrBox, Modal, Confirm } from "@/components/ui";
import { Play, Plus, RefreshCw, Star, Trash2 } from "lucide-react";

export default function Questions() {
  const session = useSession(); const toast = useToast();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [dsId, setDsId] = useState("");
  const [saved, setSaved] = useState<any[]>([]);
  const [generated, setGenerated] = useState<any[]>([]);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<any>(null); const [answerFor, setAnswerFor] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState({ question: "", category: "General", collection: "" });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  useEffect(() => { if (session.wsId) api(`/api/datasets?workspaceId=${session.wsId}`).then((d) => { setDatasets(d.datasets.filter((x: any) => x.status === "active")); setDsId(d.datasets.find((x: any) => x.status === "active")?.id || ""); }).catch((e) => setErr(e.message)); }, [session.wsId]);
  const load = useCallback(async () => {
    if (!session.wsId) return;
    try { const d = await api(`/api/work?resource=questions&workspaceId=${session.wsId}&datasetId=${dsId}`); setSaved(d.saved); setGenerated(d.generated || []); }
    catch (e: any) { setErr(e.message); }
  }, [session.wsId, dsId]);
  useEffect(() => { load(); }, [load]);

  const run = async (question: string, savedId?: string) => {
    if (!dsId) { toast("Select a dataset first.", "error"); return; }
    setBusy(true);
    try { const r = await post("/api/work", { resource: "questions", action: "run", workspaceId: session.wsId, datasetId: dsId, question, savedId }); setAnswer(r.answer); setAnswerFor(question); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const groups = [...new Set(generated.map((g) => g.category))];
  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  return (
    <AppShell session={session} title="Business Questions" subtitle="Questions generated from your dataset's actual columns and validated for answerability before being suggested. Save, favorite, run and turn results into dashboards or reports."
      actions={<>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={13} /> Regenerate</button>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCustom(true)}><Plus size={13} /> Custom question</button>
      </>}>
      {err && <ErrBox msg={err} />}
      <div className="card p-3 mb-4 flex gap-2 items-center"><label className="lbl !mb-0">Dataset</label>
        <select className="select !w-[300px]" value={dsId} onChange={(e) => setDsId(e.target.value)}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        <span className="muted text-[12px] ml-auto">{generated.filter((g) => g.answerable).length} answerable · {generated.filter((g) => !g.answerable).length} blocked by missing fields</span></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {saved.length > 0 && (
            <div className="card p-4"><p className="font-bold text-[14px] mb-2.5">Saved questions</p>
              <div className="space-y-1.5">{saved.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-[13px] rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)" }}>
                  <button onClick={async () => { await post("/api/work", { resource: "questions", action: "update", workspaceId: session.wsId, id: s.id, isFavorite: !s.isFavorite, question: s.question, category: s.category, collection: s.collection }); load(); }} title="Toggle favorite"><Star size={15} className={s.isFavorite ? "text-amber-500 fill-amber-500" : "muted"} /></button>
                  <span className="font-semibold flex-1">{s.question}</span>
                  <span className="badge b-slate">{s.category}</span>{s.collection && <span className="badge b-blue">{s.collection}</span>}
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(s.question, s.id)}><Play size={12} /> Run</button>
                  <button className="btn btn-ghost btn-sm !text-red-600" onClick={() => setDeleteTarget(s)}><Trash2 size={13} /></button>
                </div>))}</div></div>
          )}
          {groups.map((g) => (
            <div key={g} className="card p-4"><p className="font-bold text-[14px] mb-2.5">{g}</p>
              <div className="space-y-1.5">{generated.filter((x) => x.category === g).map((q) => (
                <div key={q.question} className="flex items-center gap-2 text-[13px] rounded-lg border px-2.5 py-2" style={{ borderColor: "var(--border)" }}>
                  <span className={`flex-1 font-medium ${!q.answerable ? "muted" : ""}`}>{q.question}</span>
                  {q.answerable ? <span className="badge b-emerald">answerable</span> : <span className="badge b-red" title="Required columns are missing from this dataset">needs: {q.requires.length ? "more data" : "fields"}</span>}
                  <button className="btn btn-ghost btn-sm" onClick={async () => { await post("/api/work", { resource: "questions", action: "create", workspaceId: session.wsId, datasetId: dsId, question: q.question, category: q.category }); toast("Saved"); load(); }}>Save</button>
                  <button className="btn btn-primary btn-sm" disabled={busy || !q.answerable} onClick={() => run(q.question)}><Play size={12} /> Run</button>
                </div>))}</div></div>
          ))}
        </div>
        <div>
          {answer ? <AnswerCard answer={answer} question={answerFor} onFollowup={(f) => run(f)} onSave={async () => { await post("/api/work", { resource: "questions", action: "create", workspaceId: session.wsId, datasetId: dsId, question: answerFor }); toast("Saved"); load(); }} />
            : <div className="card p-8 text-center muted text-[13px]">Run a question to see its evidence-backed answer here — figure, chart/table, method, sources, assumptions and follow-ups.</div>}
        </div>
      </div>
      <Modal open={showCustom} onClose={() => setShowCustom(false)} title="Custom question">
        <div className="space-y-3">
          <div><label className="lbl">Question</label><input className="input" value={custom.question} onChange={(e) => setCustom({ ...custom, question: e.target.value })} placeholder="e.g. Which region generated the most revenue?" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl">Category</label><select className="select" value={custom.category} onChange={(e) => setCustom({ ...custom, category: e.target.value })}>{["General", "Revenue", "Profitability", "Customers", "Products", "Marketing", "Operations", "Trends", "Anomalies", "Strategy"].map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="lbl">Collection (optional)</label><input className="input" value={custom.collection} onChange={(e) => setCustom({ ...custom, collection: e.target.value })} placeholder="e.g. Weekly review" /></div>
          </div>
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setShowCustom(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => { try { await post("/api/work", { resource: "questions", action: "create", workspaceId: session.wsId, datasetId: dsId, ...custom }); toast("Question saved"); setShowCustom(false); load(); } catch (e: any) { toast(e.message, "error"); } }}>Save question</button></div>
        </div>
      </Modal>
      <Confirm open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger title="Delete saved question?" body={`“${deleteTarget?.question}” will be removed.`}
        onConfirm={async () => { await post("/api/work", { resource: "questions", action: "delete", workspaceId: session.wsId, id: deleteTarget.id }); load(); }} />
    </AppShell>
  );
}
