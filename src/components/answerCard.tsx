"use client";
import { Chart, DataTable } from "./charts";
import { download } from "./ui";
import { Download, Star } from "lucide-react";

export function AnswerCard({ answer, question, onFollowup, onSave, onToDashboard }: { answer: any; question?: string; onFollowup?: (q: string) => void; onSave?: () => void; onToDashboard?: () => void }) {
  if (!answer) return null;
  return (
    <div className="card p-4.5 p-4">
      {question && <p className="text-[12px] muted font-semibold mb-1">Q: {question}</p>}
      <p className="text-[15px] font-semibold leading-relaxed">{answer.answer}</p>
      {answer.numbers?.length > 0 && <div className="flex flex-wrap gap-2 mt-3">{answer.numbers.map((n: any) => <span key={n.label} className="rounded-[10px] px-3 py-1.5 text-[12.5px]" style={{ background: "var(--surface2)" }}><span className="muted">{n.label}:</span> <b>{n.value}</b></span>)}</div>}
      {answer.chart && <div className="mt-3"><p className="font-bold text-[13px] mb-1">{answer.chart.title}</p><Chart type={answer.chart.type} data={answer.chart.data} height={180} /></div>}
      {answer.table?.length > 0 && !answer.chart && <div className="mt-3"><DataTable data={answer.table} /></div>}
      <div className="grid sm:grid-cols-2 gap-2.5 mt-3 text-[12px]">
        <div className="rounded-lg p-2.5" style={{ background: "var(--surface2)" }}><b>Method</b><p className="muted mt-0.5">{answer.method}</p></div>
        <div className="rounded-lg p-2.5" style={{ background: "var(--surface2)" }}><b>Sources</b><p className="muted mt-0.5">{(answer.columns || []).join(", ")} · {answer.period}</p></div>
        <div className="rounded-lg p-2.5" style={{ background: "var(--surface2)" }}><b>Assumptions & limits</b><ul className="muted mt-0.5 list-disc ml-4">{(answer.assumptions?.length ? answer.assumptions : ["None beyond standard parsing"]).map((a: string) => <li key={a}>{a}</li>)}</ul></div>
        <div className="rounded-lg p-2.5" style={{ background: "var(--surface2)" }}><b>Confidence</b><p className="muted mt-0.5">{answer.confidence}</p>{answer.actions?.length > 0 && <><b className="block mt-1.5">Suggested actions (judgment, not facts)</b><ul className="muted mt-0.5 list-disc ml-4">{answer.actions.map((a: string) => <li key={a}>{a}</li>)}</ul></>}</div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {answer.followups?.map((f: string) => <button key={f} className="btn btn-ghost btn-sm" onClick={() => onFollowup?.(f)}>{f}</button>)}
        <span className="ml-auto flex gap-1.5">
          {answer.table?.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => download("answer.csv", `Group,Value\n${answer.table.map((t: any) => `${JSON.stringify(t.label)},${t.value}`).join("\n")}`)}><Download size={13} /> CSV</button>}
          {onSave && <button className="btn btn-ghost btn-sm" onClick={onSave}><Star size={13} /> Save question</button>}
          {onToDashboard && answer.chart && <button className="btn btn-primary btn-sm" onClick={onToDashboard}>Add chart to a new dashboard</button>}
        </span>
      </div>
    </div>
  );
}
