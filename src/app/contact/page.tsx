"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PublicShell, PageHead } from "@/components/shell";
import { api, post, useToast } from "@/components/ui";
import { LifeBuoy, Mail } from "lucide-react";

export default function Contact() {
  const toast = useToast();
  const [me, setMe] = useState<any>(null);
  const [form, setForm] = useState({ name: "", email: "", topic: "General", subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/api/auth").then((d) => setMe(d.user)).catch(() => {}); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me) { toast("To guarantee a reply lands in your Support Center, please sign in or create a free account first — conversations are stored per account.", "info"); return; }
    setBusy(true);
    try { await post("/api/work", { resource: "support", action: "create", subject: form.subject, topic: form.topic, message: form.message }); toast("Message sent — track it in your Support Center."); setForm({ ...form, subject: "", message: "" }); }
    catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); }
  };
  return (
    <PublicShell>
      <PageHead title="Contact & support" sub="Support conversations are stored in your account (Support Center) so nothing gets lost and our team can see full history." />
      <div className="max-w-5xl mx-auto px-4 pb-10 grid md:grid-cols-[1fr_300px] gap-5">
        <form onSubmit={submit} className="card p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="lbl">Topic</label><select className="select" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>{["General", "Data cleaning", "Dashboards", "Billing", "Integrations", "Bug report", "Enterprise / Sales"].map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className="lbl">Subject *</label><input className="input" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief summary" /></div>
          </div>
          <div><label className="lbl">Message *</label><textarea className="textarea" rows={6} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="What happened, what you expected, and any dataset details that help us reproduce it." /></div>
          {me ? <p className="text-[12px] muted">Sending as {me.name} ({me.email}). Replies appear in <Link href="/app/support" className="link">Support Center</Link> and as notifications.</p>
            : <p className="text-[12px] muted">You're not signed in. <Link href="/login" className="link">Log in</Link> or <Link href="/register" className="link">create a free account</Link> so the conversation (and our reply) is saved to your Support Center. Email-only support activates once an email provider is configured by the operator.</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
        </form>
        <aside className="space-y-3">
          <div className="card p-4"><p className="font-bold flex items-center gap-2 text-[14px]"><LifeBuoy size={16} className="text-emerald-600" /> Support Center</p><p className="muted text-[12.5px] mt-1">Statuses: Open → In Progress → Waiting for User → Resolved → Closed. Signed-in users see full history.</p><Link href="/app/support" className="btn btn-ghost btn-sm mt-2.5">Open Support Center</Link></div>
          <div className="card p-4"><p className="font-bold flex items-center gap-2 text-[14px]"><Mail size={16} className="text-emerald-600" /> Before you write</p><p className="muted text-[12.5px] mt-1">The <Link href="/docs" className="link">documentation</Link> explains the quality score, AI methodology, demo rules and deployment. Service state is on the <Link href="/status" className="link">status page</Link>.</p></div>
        </aside>
      </div>
    </PublicShell>
  );
}
