"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, ErrBox, Modal, fmtDateTime } from "@/components/ui";
import { Plus, Send } from "lucide-react";

export default function Support() {
  const session = useSession(); const toast = useToast();
  const [convs, setConvs] = useState<any[]>([]);
  const [openId, setOpenId] = useState("");
  const [err, setErr] = useState("");
  const [reply, setReply] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ subject: "", topic: "General", priority: "Normal", message: "" });

  const load = useCallback(async () => {
    try { const d = await api("/api/work?resource=support"); setConvs(d.conversations); if (!openId && d.conversations[0]) setOpenId(d.conversations[0].id); }
    catch (e: any) { setErr(e.message); }
  }, [openId]);
  useEffect(() => { if (session.user) load(); }, [load, session.user]);
  // Light polling for new admin replies (30s) — real-time push isn't configured in this runtime.
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const open = convs.find((c) => c.id === openId);
  const send = async () => {
    if (!reply.trim() || !open) return;
    await post("/api/work", { resource: "support", action: "reply", id: open.id, message: reply }); setReply(""); load();
  };
  const statusColor = (s: string) => s === "Open" ? "b-blue" : s === "In Progress" ? "b-amber" : s === "Waiting for User" ? "b-amber" : s === "Resolved" ? "b-emerald" : "b-slate";

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  return (
    <AppShell session={session} title="Support Center" subtitle="Real conversations stored in the database. Admin replies arrive here and as notifications (this view refreshes every 30 seconds)."
      actions={<button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}><Plus size={13} /> New conversation</button>}>
      {err && <ErrBox msg={err} />}
      <div className="grid lg:grid-cols-[330px_1fr] gap-4">
        <div className="card p-2.5 h-fit">
          {convs.length === 0 ? <p className="muted text-[13px] p-2">No conversations yet.</p> : convs.map((c) => (
            <button key={c.id} onClick={() => setOpenId(c.id)} className={`w-full text-left rounded-lg px-3 py-2.5 mb-1 ${openId === c.id ? "text-white" : "hover:bg-black/5"}`} style={openId === c.id ? { background: "var(--brand)" } : {}}>
              <span className="font-bold text-[13px] block truncate">{c.subject}</span>
              <span className="text-[11.5px] opacity-80">{c.topic} · {c.messages.length} messages · {fmtDateTime(c.updatedAt)}</span>
              <span className={`badge ml-1.5 ${statusColor(c.status)}`}>{c.status}</span>
            </button>
          ))}
        </div>
        <div className="card p-4 flex flex-col min-h-[420px]">
          {!open ? <p className="muted text-[13px] text-center py-10">Select a conversation or start a new one.</p> : (
            <>
              <div className="flex flex-wrap items-center gap-2 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
                <b className="text-[14.5px]">{open.subject}</b>
                <span className={`badge ${statusColor(open.status)}`}>{open.status}</span>
                <span className="badge b-slate">{open.priority} priority</span>
                {open.status !== "Closed" && <button className="btn btn-ghost btn-sm ml-auto" onClick={async () => { await post("/api/work", { resource: "support", action: "close", id: open.id }); toast("Conversation closed"); load(); }}>Close conversation</button>}
              </div>
              <div className="flex-1 overflow-y-auto py-3 space-y-2.5 max-h-[460px]">
                {open.messages.map((m: any) => (
                  <div key={m.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] ${m.senderRole === "admin" ? "mr-auto" : "ml-auto text-white"}`} style={m.senderRole === "admin" ? { background: "var(--surface2)" } : { background: "linear-gradient(135deg,#059669,#0d9488)" }}>
                    <p className="text-[11px] font-bold opacity-80">{m.senderName} · {fmtDateTime(m.createdAt)}</p>
                    <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
              {open.status !== "Closed" && (
                <div className="flex gap-2 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                  <input className="input flex-1" placeholder="Reply…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
                  <button className="btn btn-primary" onClick={send}><Send size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New support conversation">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl">Topic</label><select className="select" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>{["General", "Data cleaning", "Dashboards", "AI analyst", "Billing", "Integrations", "Bug report", "Account"].map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className="lbl">Priority</label><select className="select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{["Low", "Normal", "High", "Urgent"].map((t) => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div><label className="lbl">Subject *</label><input className="input" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="lbl">Describe the problem *</label><textarea className="textarea" rows={4} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          <p className="muted text-[11.5px]">File attachments aren't accepted in this build — include dataset name and row numbers instead; our team can reference them via your account with your permission.</p>
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => { try { const r = await post("/api/work", { resource: "support", action: "create", ...form }); toast("Conversation opened"); setShowNew(false); setOpenId(r.conversation.id); load(); } catch (e: any) { toast(e.message, "error"); } }}>Send</button></div>
        </div>
      </Modal>
    </AppShell>
  );
}
