"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, useSession } from "@/components/shell";
import { AnswerCard } from "@/components/answerCard";
import { api, post, useToast, Spinner, ErrBox, Empty } from "@/components/ui";
import { Send } from "lucide-react";

interface Turn { q: string; a: any }
export default function Analyst() {
  const session = useSession(); const toast = useToast(); const router = useRouter();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [dsId, setDsId] = useState("");
  const [suggested, setSuggested] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [quota, setQuota] = useState<any>(null);

  useEffect(() => {
    if (!session.wsId) return;
    api(`/api/datasets?workspaceId=${session.wsId}`).then((d) => { setDatasets(d.datasets.filter((x: any) => x.status === "active")); setDsId(d.datasets.find((x: any) => x.status === "active")?.id || ""); }).catch((e) => setErr(e.message));
  }, [session.wsId]);

  const loadQs = useCallback(async () => {
    if (!dsId) return;
    try { const d = await api(`/api/work?resource=questions&workspaceId=${session.wsId}&datasetId=${dsId}`); setSuggested(d.generated || []); } catch {}
  }, [dsId, session.wsId]);
  useEffect(() => { loadQs(); }, [loadQs]);

  const ask = async (qText?: string) => {
    const q = (qText || input).trim(); if (!q || !dsId) return;
    setBusy(true); setInput("");
    try {
      const r = await post("/api/work", { resource: "analyst", workspaceId: session.wsId, datasetId: dsId, question: q });
      setTurns((t) => [{ q, a: r.answer }, ...t]); setQuota({ used: r.used, limit: r.limit, engine: r.engine });
    } catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  const saveQ = async (q: string) => { try { await post("/api/work", { resource: "questions", action: "create", workspaceId: session.wsId, datasetId: dsId, question: q }); toast("Saved to Business Questions"); } catch (e: any) { toast(e.message, "error"); } };
  const toDashboard = async (turn: Turn) => {
    const c = turn.a.chart; if (!c) return;
    try {
      const widget = { id: Math.random().toString(36).slice(2, 9), type: c.type, title: c.title, metric: "", dimension: "", agg: "sum", width: 6, color: "#059669", staticData: c.data };
      const r = await post("/api/work", { resource: "dashboards", action: "create", workspaceId: session.wsId, datasetId: dsId, name: `From AI: ${turn.q.slice(0, 60)}`, widgets: [widget] });
      toast("Dashboard created"); router.push(`/app/dashboards/${r.dashboard.id}`);
    } catch (e: any) { toast(e.message, "error"); }
  };

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  return (
    <AppShell session={session} title="AI Business Analyst" subtitle="Questions are answered by a validated, deterministic analytics layer over your authorized dataset — numbers are never invented. Every answer shows method, sources, period, assumptions and confidence.">
      {err && <ErrBox msg={err} />}
      {!datasets.length ? <Empty title="No dataset to ask about" body="Import a dataset in the Data Hub first — the analyst can only answer from data that exists." /> : (
        <div className="grid lg:grid-cols-[300px_1fr] gap-4">
          <div className="space-y-3">
            <div className="card p-3.5">
              <label className="lbl">Dataset</label>
              <select className="select" value={dsId} onChange={(e) => { setDsId(e.target.value); setTurns([]); }}>{datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              {quota && <p className="muted text-[11.5px] mt-2">AI usage this month: {quota.used}/{quota.limit}<br />Engine: {quota.engine}</p>}
              {!quota && <p className="muted text-[11.5px] mt-2">Engine: deterministic analytics (built-in). Usage is metered against your plan.</p>}
            </div>
            <div className="card p-3.5">
              <p className="font-bold text-[13px] mb-2">Answerable from this data</p>
              <div className="space-y-1.5">{suggested.filter((s) => s.answerable).slice(0, 10).map((s) => <button key={s.question} onClick={() => ask(s.question)} className="btn btn-ghost btn-sm w-full justify-start !whitespace-normal text-left">{s.question}</button>)}</div>
              {suggested.some((s) => !s.answerable) && <><p className="font-bold text-[12.5px] mt-3 mb-1">Not answerable yet (missing fields)</p>{suggested.filter((s) => !s.answerable).map((s) => <p key={s.question} className="muted text-[12px] py-0.5 line-through">{s.question}</p>)}</>}
            </div>
          </div>
          <div className="space-y-3">
            <div className="card p-3 flex gap-2">
              <input className="input flex-1" placeholder="Ask: Why did revenue change? Top products? Which customers stopped buying? Profit margin?" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} aria-label="Ask a business question" />
              <button className="btn btn-primary" disabled={busy} onClick={() => ask()}><Send size={15} />{busy ? "Computing…" : "Ask"}</button>
            </div>
            {turns.length === 0 && <div className="card p-6 text-center muted text-[13px]">Try “What is total revenue?”, “Compare the latest month with the previous month”, or “Which customers have stopped purchasing?” — ambiguous questions get an explicit interpretation, unanswerable ones an honest refusal.</div>}
            {turns.map((t, i) => <AnswerCard key={i} answer={t.a} question={t.q} onFollowup={(f) => ask(f)} onSave={() => saveQ(t.q)} onToDashboard={() => toDashboard(t)} />)}
          </div>
        </div>
      )}
    </AppShell>
  );
}
