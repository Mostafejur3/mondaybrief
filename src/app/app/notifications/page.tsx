"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, fmtDateTime } from "@/components/ui";

export default function Notifications() {
  const session = useSession(); const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [filter, setFilter] = useState("all");
  const load = useCallback(async () => { const d = await api("/api/work?resource=notifications"); setList(d.notifications); }, []);
  useEffect(() => { if (session.user) load(); }, [load, session.user]);
  const markAll = async () => { await post("/api/work", { resource: "notifications", action: "readAll" }); toast("All marked read"); load(); };
  const markOne = async (id: string) => { await post("/api/work", { resource: "notifications", action: "read", id }); load(); };
  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  const filtered = (list || []).filter((n) => filter === "all" || (filter === "unread" ? !n.readAt : n.type === filter));
  return (
    <AppShell session={session} title="Notifications" subtitle="Processing results, billing events, support replies, alerts and announcements — stored in the database with read/unread state."
      actions={<button className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button>}>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {["all", "unread", "success", "billing", "support", "alert", "automation", "announcement", "info"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm capitalize ${filter === f ? "btn-primary" : "btn-ghost"}`}>{f}</button>
        ))}
      </div>
      {!list ? <Spinner /> : filtered.length === 0 ? <div className="card p-8 text-center muted text-[13px]">No notifications match this filter.</div> : (
        <div className="card divide-y" style={{ borderColor: "var(--border)" }}>
          {filtered.map((n) => (
            <div key={n.id} className={`px-4 py-3 flex gap-3 items-start ${!n.readAt ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`}>
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.readAt ? "bg-emerald-500" : "bg-slate-300"}`} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[13.5px]">{n.title} <span className="badge b-slate capitalize ml-1">{n.type}</span></p>
                <p className="muted text-[12.5px] mt-0.5">{n.body}</p>
                <p className="muted text-[11px] mt-1">{fmtDateTime(n.createdAt)}{n.readAt ? ` · read ${fmtDateTime(n.readAt)}` : ""}</p>
              </div>
              {n.link && <Link href={n.link} className="btn btn-ghost btn-sm shrink-0">Open</Link>}
              {!n.readAt && <button className="btn btn-ghost btn-sm shrink-0" onClick={() => markOne(n.id)}>Mark read</button>}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
