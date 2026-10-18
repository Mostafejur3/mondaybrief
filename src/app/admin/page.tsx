"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/shell";
import { api, post, useToast, useTheme, Spinner, ErrBox, Modal, Confirm, money, fmtDateTime, fmtDateOnly, download } from "@/components/ui";
import { Chart } from "@/components/charts";
import {
  Activity, Bell, CreditCard, Database, FileText, Globe, LayoutDashboard, LifeBuoy, LogOut, Menu, Moon,
  ScrollText, Search, Settings as Cog, ShieldCheck, Sun, Users, Wallet, Wrench, X,
} from "lucide-react";

const TABS: [string, string, any][] = [
  ["overview", "Overview", LayoutDashboard], ["users", "Users", Users], ["workspaces", "Workspaces", Database],
  ["subscriptions", "Subscriptions", Wallet], ["plans", "Plans & Entitlements", CreditCard], ["invoices", "Invoices & Payments", FileText],
  ["support", "Support Inbox", LifeBuoy], ["cms", "Website CMS", Globe], ["broadcast", "Broadcasts", Bell],
  ["settings", "App Settings & Flags", Cog], ["health", "System Health", Activity], ["jobs", "Jobs & Runs", Wrench], ["audit", "Audit Logs", ScrollText],
];

export default function Admin() {
  const router = useRouter(); const toast = useToast(); const { dark, toggle } = useTheme();
  const [me, setMe] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api("/api/auth").then((d) => {
      if (!d.user || !["admin", "super_admin", "support"].includes(d.user.role)) { router.push("/admin/login"); return; }
      setMe(d.user);
    }).catch(() => router.push("/admin/login"));
  }, [router]);

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true); setErr("");
    const resource = tab === "cms" || tab === "settings" || tab === "broadcast" ? "settings" : tab;
    try { setData(await api(`/api/admin?resource=${resource}`)); } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [me, tab]);
  useEffect(() => { load(); }, [load]);

  const logout = async () => { await post("/api/auth", { action: "logout" }).catch(() => {}); router.push("/admin/login"); };
  if (!me) return <div className="p-8"><Spinner label="Verifying administrator session…" /></div>;

  const nav = (
    <div className="h-full flex flex-col" style={{ background: "var(--sidebar)" }}>
      <div className="px-3.5 py-3.5 border-b border-white/10"><Logo light /><p className="text-[11px] text-emerald-200/70 mt-1 font-bold uppercase tracking-wider">Admin Control Center</p></div>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => { setTab(id); setMobile(false); }} className={`navitem w-full text-left ${tab === id ? "active" : ""}`}><Icon size={16} />{label}</button>
        ))}
      </nav>
      <div className="p-3 border-t border-white/10 space-y-1">
        <Link href="/app" className="navitem"><LayoutDashboard size={16} /> User application</Link>
        <Link href="/" className="navitem"><Globe size={16} /> Public website</Link>
        <button onClick={logout} className="navitem w-full"><LogOut size={16} /> Sign out</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:block w-[240px] shrink-0 sticky top-0 h-screen">{nav}</aside>
      {mobile && <div className="fixed inset-0 z-[120] md:hidden"><div className="absolute inset-0 bg-black/50" onClick={() => setMobile(false)} /><aside className="relative w-[250px] h-full">{nav}</aside></div>}
      <div className="flex-1 min-w-0">
        <header className="glass sticky top-0 z-[60] border-b h-[56px] flex items-center gap-2 px-3 sm:px-5">
          <button className="md:hidden btn btn-ghost btn-sm" onClick={() => setMobile(true)} aria-label="Menu"><Menu size={16} /></button>
          <ShieldCheck size={17} className="text-emerald-600" />
          <span className="font-extrabold text-[15px]">{TABS.find((t) => t[0] === tab)?.[1]}</span>
          <span className="badge b-emerald capitalize">{me.role.replace("_", " ")}</span>
          <div className="relative hidden sm:block w-[200px] ml-2"><Search size={14} className="absolute left-2.5 top-[9px] muted" /><input className="input pl-8" placeholder="Filter this view…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <span className="ml-auto flex items-center gap-2">
            <button onClick={toggle} className="btn btn-ghost btn-sm" aria-label="Theme">{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: "linear-gradient(135deg,#059669,#0d9488)" }}>{me.name.split(" ").map((x: string) => x[0]).slice(0, 2).join("")}</span>
            <span className="hidden xl:block text-[12.5px] font-bold">{me.name}</span>
          </span>
        </header>
        <main className="p-3.5 sm:p-5 max-w-[1500px] mx-auto">
          {err && <ErrBox msg={err} />}
          {loading ? <Spinner /> : !data ? null : (
            <>
              {tab === "overview" && <Overview data={data} toast={toast} reload={load} me={me} />}
              {tab === "users" && <UsersTab data={data} toast={toast} reload={load} me={me} search={search} />}
              {tab === "workspaces" && <WorkspacesTab data={data} search={search} />}
              {tab === "subscriptions" && <SubsTab data={data} toast={toast} reload={load} search={search} />}
              {tab === "plans" && <PlansTab data={data} toast={toast} reload={load} />}
              {tab === "invoices" && <InvoicesTab data={data} toast={toast} reload={load} me={me} search={search} />}
              {tab === "support" && <SupportTab data={data} toast={toast} reload={load} search={search} />}
              {tab === "cms" && <CmsTab data={data} toast={toast} reload={load} />}
              {tab === "broadcast" && <BroadcastTab toast={toast} />}
              {tab === "settings" && <SettingsTab data={data} toast={toast} reload={load} me={me} />}
              {tab === "health" && <HealthTab data={data} reload={load} toast={toast} me={me} />}
              {tab === "jobs" && <JobsTab data={data} />}
              {tab === "audit" && <AuditTab data={data} search={search} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

const act = async (toast: any, reload: () => void, body: any, msg = "Done") => {
  try { await post("/api/admin", body); toast(msg); reload(); } catch (e: any) { toast(e.message, "error"); }
};

function Overview({ data, toast, reload, me }: any) {
  const s = data.stats;
  const cards: [string, string, string][] = [
    ["Registered users", String(s.users), `${s.activeUsers} active · ${s.newThisMonth} new this month`],
    ["Active subscriptions", String(s.activeSubs), "development-billing records"],
    ["MRR", money(s.mrrCents), s.mrrDefinition],
    ["Revenue this month", money(s.revenueThisMonthCents), "paid invoices issued this month"],
    ["Datasets / rows", `${s.datasets}`, `${s.rowsStored.toLocaleString()} rows stored`],
    ["AI questions answered", String(s.aiQuestions), "deterministic engine, metered per plan"],
    ["Open support tickets", String(s.openTickets), "status = Open"],
    ["Failed jobs (recent)", String(s.failedJobs), "of the last 10 tracked jobs"],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(([l, v, sub]) => <div key={l} className="card p-3.5"><p className="muted text-[11px] font-bold uppercase tracking-wide">{l}</p><p className="text-[22px] font-extrabold mt-0.5">{v}</p><p className="muted text-[11px]">{sub}</p></div>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4"><p className="font-bold text-[13.5px] mb-1">Subscriptions by plan</p><Chart type="bar" data={data.subByPlan} height={170} /></div>
        <div className="card p-4"><p className="font-bold text-[13.5px] mb-1">Registrations by month</p><Chart type="area" data={data.registrations} height={170} /></div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden"><p className="font-bold text-[13.5px] px-4 pt-3">Newest users</p>
          <table className="data"><tbody>{data.recentUsers.map((u: any) => <tr key={u.id}><td><b>{u.name}</b><br /><span className="muted">{u.email}</span></td><td className="capitalize">{u.role}</td><td>{fmtDateOnly(u.createdAt)}</td></tr>)}</tbody></table></div>
        <div className="card overflow-hidden"><p className="font-bold text-[13.5px] px-4 pt-3">Recent audit events</p>
          <table className="data"><tbody>{data.recentAudit.map((a: any) => <tr key={a.id}><td className="font-semibold">{a.action}</td><td className="muted">{a.actorEmail}</td><td>{fmtDateTime(a.createdAt)}</td></tr>)}</tbody></table></div>
      </div>
      <p className="muted text-[12px]">All figures come from live database records. Seed/fictional accounts are flagged with isSeed in the Users tab.</p>
    </div>
  );
}

function UsersTab({ data, toast, reload, me, search }: any) {
  const [msgTarget, setMsgTarget] = useState<any>(null);
  const [msg, setMsg] = useState({ subject: "", message: "" });
  const [confirm, setConfirm] = useState<any>(null);
  const users = data.users.filter((u: any) => !search || `${u.name} ${u.email} ${u.role} ${u.status}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto"><table className="data"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Workspaces</th><th>Subs</th><th>Joined</th><th>Last login</th><th className="!text-right">Actions</th></tr></thead>
        <tbody>{users.map((u: any) => (
          <tr key={u.id}>
            <td><b>{u.name}</b>{u.isSeed && <span className="badge b-amber ml-1.5">seed</span>}<br /><span className="muted">{u.email}</span></td>
            <td>{me.role === "super_admin" && u.role !== "super_admin" ? <select className="select !w-[120px] !py-1" value={u.role} onChange={(e) => act(toast, reload, { resource: "users", action: "role", id: u.id, role: e.target.value }, "Role updated (audited)")}>{["user", "support", "admin"].map((r) => <option key={r}>{r}</option>)}</select> : <span className="badge b-slate capitalize">{u.role.replace("_", " ")}</span>}</td>
            <td><span className={`badge ${u.status === "active" ? "b-emerald" : "b-red"}`}>{u.status}</span></td>
            <td>{u.workspaces}</td><td>{u.subscriptions}</td><td>{fmtDateOnly(u.createdAt)}</td><td>{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "—"}</td>
            <td className="!text-right whitespace-nowrap">
              <button className="btn btn-ghost btn-sm" onClick={() => setMsgTarget(u)}>Message</button>{" "}
              <button className="btn btn-ghost btn-sm" onClick={() => act(toast, reload, { resource: "users", action: "revokeSessions", id: u.id }, "Sessions revoked")}>Revoke sessions</button>{" "}
              <button className="btn btn-ghost btn-sm" onClick={() => act(toast, reload, { resource: "users", action: u.status === "active" ? "suspend" : "activate", id: u.id }, u.status === "active" ? "Suspended & signed out" : "Reactivated")}>{u.status === "active" ? "Suspend" : "Reactivate"}</button>{" "}
              {me.role === "super_admin" && u.role !== "super_admin" && <button className="btn btn-ghost btn-sm !text-red-600" onClick={() => setConfirm(u)}>Delete</button>}
            </td></tr>))}
        </tbody></table></div>
      <Modal open={!!msgTarget} onClose={() => setMsgTarget(null)} title={`Message ${msgTarget?.name}`}>
        <div className="space-y-3"><div><label className="lbl">Subject</label><input className="input" value={msg.subject} onChange={(e) => setMsg({ ...msg, subject: e.target.value })} /></div>
          <div><label className="lbl">Message (delivered to their Support Center + notification)</label><textarea className="textarea" rows={4} value={msg.message} onChange={(e) => setMsg({ ...msg, message: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setMsgTarget(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { act(toast, reload, { resource: "users", action: "message", id: msgTarget.id, ...msg }, "Message delivered in-app"); setMsgTarget(null); }}>Send</button></div></div>
      </Modal>
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} danger title="Delete user permanently?" body={`${confirm?.name} (${confirm?.email}) and all workspaces they own will be deleted. This is audited and irreversible.`}
        onConfirm={() => act(toast, reload, { resource: "users", action: "delete", id: confirm.id }, "User deleted")} />
    </div>
  );
}

function WorkspacesTab({ data, search }: any) {
  const ws = data.workspaces.filter((w: any) => !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.ownerEmail.toLowerCase().includes(search.toLowerCase()));
  return <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="data"><thead><tr><th>Workspace</th><th>Owner</th><th>Plan</th><th>Members</th><th>Datasets</th><th>Created</th></tr></thead>
    <tbody>{ws.map((w: any) => <tr key={w.id}><td className="font-semibold">{w.name}{w.isDemo && <span className="badge b-amber ml-1">demo</span>}</td><td>{w.ownerEmail}</td><td className="capitalize">{w.planId}</td><td>{w.members}</td><td>{w.datasets}</td><td>{fmtDateOnly(w.createdAt)}</td></tr>)}</tbody></table></div></div>;
}

function SubsTab({ data, toast, reload, search }: any) {
  const subs = data.subscriptions.filter((s: any) => !search || `${s.userEmail} ${s.planId} ${s.status}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="data"><thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Cycle</th><th>Period end</th><th>Provider</th><th className="!text-right">Actions</th></tr></thead>
    <tbody>{subs.map((s: any) => <tr key={s.id}><td>{s.userEmail}</td>
      <td><select className="select !w-[130px] !py-1" value={s.planId} onChange={(e) => act(toast, reload, { resource: "subscriptions", action: "changePlan", id: s.id, planId: e.target.value }, "Plan changed & invoice issued (dev billing)")}>{["free", "basic", "pro", "business", "enterprise"].map((p) => <option key={p}>{p}</option>)}</select></td>
      <td><span className={`badge ${s.status === "active" ? "b-emerald" : "b-slate"}`}>{s.status}{s.cancelAtPeriodEnd ? " (cancels at end)" : ""}</span></td>
      <td>{s.billingCycle}</td><td>{s.currentPeriodEnd ? fmtDateOnly(s.currentPeriodEnd) : "—"}</td><td>{s.provider}</td>
      <td className="!text-right">{s.status === "active" && <button className="btn btn-ghost btn-sm !text-red-600" onClick={() => act(toast, reload, { resource: "subscriptions", action: "cancel", id: s.id }, "Canceled — workspace moved to Free, user notified")}>Cancel</button>}</td></tr>)}</tbody></table></div>
    <p className="muted text-[12px] p-3">Provider reconciliation (Stripe): once live keys + webhook secret are configured, webhook events — not this UI — become the source of truth. Development records are labelled “development”.</p></div>;
}

function PlansTab({ data, toast, reload }: any) {
  const [editing, setEditing] = useState<any>(null);
  return (
    <div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {data.plans.map((p: any) => (
          <div key={p.id} className="card p-4">
            <div className="flex items-center gap-2"><b className="text-[15px]">{p.name}</b><span className={`badge ml-auto ${p.isActive ? "b-emerald" : "b-red"}`}>{p.isActive ? "active" : "hidden"}</span></div>
            <p className="muted text-[12px]">{p.tagline}</p>
            <p className="mt-2 text-[13px]">{money(p.priceMonthly)}/mo · {money(p.priceYearly)}/yr</p>
            <ul className="text-[12px] muted mt-2 space-y-0.5">
              <li>Rows/dataset: {Number(p.limits?.maxRowsPerDataset || 0).toLocaleString()} · File: {p.limits?.maxFileSizeMB} MB</li>
              <li>Datasets: {p.limits?.maxDatasets} · Dashboards: {p.limits?.maxDashboards} · Reports: {p.limits?.maxReports}</li>
              <li>AI questions/mo: {Number(p.limits?.aiQuestionsPerMonth || 0).toLocaleString()} · Automation: {p.limits?.automation ? "yes" : "no"} · Integrations: {p.limits?.integrations ? "yes" : "no"}</li>
            </ul>
            <button className="btn btn-ghost btn-sm mt-3" onClick={() => setEditing(JSON.parse(JSON.stringify(p)))}>Edit plan</button>
          </div>
        ))}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit plan — ${editing?.name}`} wide>
        {editing && <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="lbl">Name</label><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
          <div><label className="lbl">Tagline</label><input className="input" value={editing.tagline} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} /></div>
          <div><label className="lbl">Monthly price (cents)</label><input className="input" type="number" value={editing.priceMonthly} onChange={(e) => setEditing({ ...editing, priceMonthly: Number(e.target.value) })} /></div>
          <div><label className="lbl">Yearly price (cents)</label><input className="input" type="number" value={editing.priceYearly} onChange={(e) => setEditing({ ...editing, priceYearly: Number(e.target.value) })} /></div>
          {["maxRowsPerDataset", "maxFileSizeMB", "maxDatasets", "maxDashboards", "aiQuestionsPerMonth", "maxReports"].map((k) => (
            <div key={k}><label className="lbl">{k}</label><input className="input" type="number" value={editing.limits[k]} onChange={(e) => setEditing({ ...editing, limits: { ...editing.limits, [k]: Number(e.target.value) } })} /></div>
          ))}
          {["automation", "integrations"].map((k) => (
            <label key={k} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!editing.limits[k]} onChange={(e) => setEditing({ ...editing, limits: { ...editing.limits, [k]: e.target.checked } })} />{k}</label>
          ))}
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />Visible on Pricing page</label>
          <div className="sm:col-span-2"><label className="lbl">Features (one per line)</label><textarea className="textarea" rows={4} value={(editing.features || []).join("\n")} onChange={(e) => setEditing({ ...editing, features: e.target.value.split("\n").filter(Boolean) })} /></div>
          <p className="muted text-[12px] sm:col-span-2">Changes apply immediately to the Pricing page and server-side quota checks. When Stripe is live, mirror prices there (price IDs) — this panel remains the display/quota source.</p>
          <div className="flex justify-end gap-2 sm:col-span-2"><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => { act(toast, reload, { resource: "plans", action: "update", id: editing.id, plan: editing }, "Plan updated (audited)"); setEditing(null); }}>Save plan</button></div>
        </div>}
      </Modal>
    </div>
  );
}

function InvoicesTab({ data, toast, reload, me, search }: any) {
  const invs = data.invoices.filter((i: any) => !search || `${i.number} ${i.userEmail} ${i.status}`.toLowerCase().includes(search.toLowerCase()));
  const printInv = (inv: any) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>${inv.number}</title><style>body{font-family:system-ui;margin:40px}td,th{border-bottom:1px solid #ddd;padding:8px;font-size:13px}table{width:100%;border-collapse:collapse}.r{text-align:right}</style></head><body><h1>Invoice ${inv.number}</h1><p>${inv.userName} (${inv.userEmail}) · Issued ${fmtDateOnly(inv.issuedAt)} · Status ${inv.status} · Provider ${inv.provider}</p><table><tr><th>Description</th><th class="r">Amount</th></tr>${(inv.lines || []).map((l: any) => `<tr><td>${l.description}</td><td class="r">${money(l.amount)}</td></tr>`).join("")}<tr><td><b>Total</b></td><td class="r"><b>${money(inv.amount)} ${inv.currency}</b></td></tr></table><script>window.print()<\/script></body></html>`);
  };
  return <div>
    <div className="flex gap-2 mb-3"><span className="badge b-emerald">Collected: {money(invs.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + i.amount, 0))}</span><span className="badge b-amber">Open: {money(invs.filter((i: any) => i.status === "open").reduce((s: number, i: any) => s + i.amount, 0))}</span>
      <button className="btn btn-ghost btn-sm ml-auto" onClick={() => download("invoices.csv", `Number,User,Amount,Status,Issued\n${invs.map((i: any) => `${i.number},${i.userEmail},${i.amount / 100},${i.status},${fmtDateOnly(i.issuedAt)}`).join("\n")}`)}>Export CSV</button></div>
    <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="data"><thead><tr><th>Number</th><th>Customer</th><th>Amount</th><th>Status</th><th>Issued</th><th>Paid</th><th>Provider</th><th className="!text-right">Actions</th></tr></thead>
      <tbody>{invs.map((inv: any) => <tr key={inv.id}><td className="font-semibold">{inv.number}</td><td>{inv.userName}<br /><span className="muted">{inv.userEmail}</span></td><td>{money(inv.amount)}</td>
        <td><select className="select !w-[110px] !py-1" value={inv.status} onChange={(e) => act(toast, reload, { resource: "invoices", action: "status", id: inv.id, status: e.target.value }, "Invoice updated")}>{["paid", "open", "void", "refunded"].map((s) => <option key={s}>{s}</option>)}</select></td>
        <td>{fmtDateOnly(inv.issuedAt)}</td><td>{inv.paidAt ? fmtDateOnly(inv.paidAt) : "—"}</td><td>{inv.provider}</td>
        <td className="!text-right"><button className="btn btn-ghost btn-sm" onClick={() => printInv(inv)}>PDF</button></td></tr>)}</tbody></table></div></div>
  </div>;
}

function SupportTab({ data, toast, reload, search }: any) {
  const [openId, setOpenId] = useState("");
  const [reply, setReply] = useState(""); const [note, setNote] = useState("");
  const convs = data.conversations.filter((c: any) => !search || `${c.subject} ${c.user?.email} ${c.status}`.toLowerCase().includes(search.toLowerCase()));
  const open = convs.find((c: any) => c.id === openId) || convs[0];
  return (
    <div className="grid lg:grid-cols-[330px_1fr] gap-4">
      <div className="card p-2.5 h-fit">
        {convs.length === 0 ? <p className="muted text-[13px] p-2">Inbox zero.</p> : convs.map((c: any) => (
          <button key={c.id} onClick={() => setOpenId(c.id)} className={`w-full text-left rounded-lg px-3 py-2.5 mb-1 ${open?.id === c.id ? "text-white" : "hover:bg-black/5"}`} style={open?.id === c.id ? { background: "var(--brand)" } : {}}>
            <span className="font-bold text-[13px] block truncate">{c.subject}</span>
            <span className="text-[11.5px] opacity-80">{c.user?.name} · {c.user?.email}</span>
            <span className="badge b-slate ml-1.5">{c.status}</span><span className="badge b-amber ml-1">{c.priority}</span>
          </button>
        ))}
      </div>
      <div className="card p-4">
        {!open ? <p className="muted text-[13px]">Select a conversation.</p> : <>
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
            <b>{open.subject}</b><span className="muted text-[12px]">{open.user?.name} ({open.user?.email}) · {open.topic}</span>
            <span className="ml-auto flex gap-1.5">
              <select className="select !w-[150px] !py-1.5" value={open.status} onChange={(e) => act(toast, reload, { resource: "support", action: "status", id: open.id, status: e.target.value }, "Status updated")}>{["Open", "In Progress", "Waiting for User", "Resolved", "Closed"].map((s) => <option key={s}>{s}</option>)}</select>
              <select className="select !w-[120px] !py-1.5" value={open.priority} onChange={(e) => act(toast, reload, { resource: "support", action: "priority", id: open.id, priority: e.target.value }, "Priority updated")}>{["Low", "Normal", "High", "Urgent"].map((s) => <option key={s}>{s}</option>)}</select>
            </span>
          </div>
          <div className="py-3 space-y-2.5 max-h-[420px] overflow-y-auto">
            {open.messages.map((m: any) => (
              <div key={m.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] ${m.isInternal ? "border border-dashed border-amber-400 mr-auto" : m.senderRole === "admin" ? "ml-auto text-white" : "mr-auto"}`} style={m.isInternal ? { background: "#fffbeb" } : m.senderRole === "admin" ? { background: "linear-gradient(135deg,#059669,#0d9488)" } : { background: "var(--surface2)" }}>
                <p className="text-[11px] font-bold opacity-80">{m.senderName}{m.isInternal ? " · INTERNAL NOTE (hidden from user)" : ""} · {fmtDateTime(m.createdAt)}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="flex gap-2"><input className="input flex-1" placeholder="Reply to user…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button className="btn btn-primary" onClick={() => { act(toast, reload, { resource: "support", action: "reply", id: open.id, message: reply }, "Reply sent + user notified"); setReply(""); }}>Send</button></div>
            <div className="flex gap-2"><input className="input flex-1" placeholder="Internal note (team only)…" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn btn-ghost" onClick={() => { act(toast, reload, { resource: "support", action: "note", id: open.id, message: note }, "Internal note saved"); setNote(""); }}>Add note</button></div>
          </div>
        </>}
      </div>
    </div>
  );
}

function CmsTab({ data, toast, reload }: any) {
  const [cms, setCms] = useState<any>(null);
  useEffect(() => { if (data?.settings?.cms) setCms(JSON.parse(JSON.stringify(data.settings.cms))); }, [data]);
  if (!cms) return <Spinner />;
  const save = async () => { await post("/api/admin", { resource: "settings", key: "cms", value: cms }); toast("Website content published"); reload(); };
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-4 space-y-3">
        <p className="font-bold text-[14px]">Homepage content</p>
        <div><label className="lbl">Announcement banner</label><input className="input" value={cms.announcement || ""} onChange={(e) => setCms({ ...cms, announcement: e.target.value })} /></div>
        <div><label className="lbl">Hero headline</label><input className="input" value={cms.heroHeadline} onChange={(e) => setCms({ ...cms, heroHeadline: e.target.value })} /></div>
        <div><label className="lbl">Hero subheading</label><textarea className="textarea" rows={3} value={cms.heroSub} onChange={(e) => setCms({ ...cms, heroSub: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="lbl">Primary CTA</label><input className="input" value={cms.primaryCta} onChange={(e) => setCms({ ...cms, primaryCta: e.target.value })} /></div>
          <div><label className="lbl">Secondary CTA</label><input className="input" value={cms.secondaryCta} onChange={(e) => setCms({ ...cms, secondaryCta: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="lbl">Support email (display)</label><input className="input" value={cms.supportEmail} onChange={(e) => setCms({ ...cms, supportEmail: e.target.value })} /></div>
          <div><label className="lbl">Footer tagline</label><input className="input" value={cms.footerNote} onChange={(e) => setCms({ ...cms, footerNote: e.target.value })} /></div>
        </div>
        <button className="btn btn-primary" onClick={save}>Publish changes</button>
        <p className="muted text-[11.5px]">Safe content only — the CMS cannot inject scripts. Pricing is managed in Plans; this panel never hardcodes prices.</p>
      </div>
      <div className="card p-4">
        <p className="font-bold text-[14px] mb-2">FAQ items</p>
        <div className="space-y-2.5 max-h-[480px] overflow-y-auto">
          {(cms.faq || []).map((f: any, i: number) => (
            <div key={i} className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
              <input className="input mb-1.5" value={f.q} onChange={(e) => { const faq = [...cms.faq]; faq[i] = { ...faq[i], q: e.target.value }; setCms({ ...cms, faq }); }} />
              <textarea className="textarea" rows={2} value={f.a} onChange={(e) => { const faq = [...cms.faq]; faq[i] = { ...faq[i], a: e.target.value }; setCms({ ...cms, faq }); }} />
              <button className="link text-[12px] mt-1" onClick={() => setCms({ ...cms, faq: cms.faq.filter((_: any, j: number) => j !== i) })}>Remove</button>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm mt-3" onClick={() => setCms({ ...cms, faq: [...(cms.faq || []), { q: "New question", a: "Answer…" }] })}>Add FAQ</button>
        <button className="btn btn-primary btn-sm mt-3 ml-2" onClick={save}>Publish FAQ</button>
      </div>
    </div>
  );
}

function BroadcastTab({ toast }: any) {
  const [form, setForm] = useState({ title: "", body: "", link: "/app" });
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="card p-5 max-w-2xl">
      <p className="font-bold text-[15px] mb-1">In-app broadcast</p>
      <p className="muted text-[12.5px] mb-4">Sends a real in-app notification to every active user (stored in the database). This is not an email blast.</p>
      <div className="space-y-3">
        <div><label className="lbl">Title</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Scheduled maintenance Sunday 02:00 UTC" /></div>
        <div><label className="lbl">Body</label><textarea className="textarea" rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <div><label className="lbl">Link</label><input className="input" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div>
        <button className="btn btn-primary" disabled={!form.title} onClick={() => setConfirm(true)}>Review & broadcast</button>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Broadcast to all active users?" body={`“${form.title}” will be delivered as an in-app notification immediately.`}
        onConfirm={async () => { const r = await post("/api/admin", { resource: "broadcast", ...form }); toast(`Broadcast delivered to ${r.recipients} users`); setForm({ title: "", body: "", link: "/app" }); }} />
    </div>
  );
}

function SettingsTab({ data, toast, reload, me }: any) {
  const [app, setApp] = useState<any>(null); const [flags, setFlags] = useState<any>(null); const [providers, setProviders] = useState<any>(null);
  useEffect(() => { if (data?.settings) { setApp({ ...data.settings.app }); setFlags({ ...data.settings.featureFlags }); setProviders({ ...data.settings.providers }); } }, [data]);
  if (!app) return <Spinner />;
  const saveKey = async (key: string, value: any, msg: string) => { await post("/api/admin", { resource: "settings", key, value }); toast(msg); reload(); };
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="card p-4 space-y-3">
        <p className="font-bold text-[14px]">Application settings</p>
        <div><label className="lbl">Demo row limit (server-enforced)</label><input className="input" type="number" value={app.demoRowLimit} onChange={(e) => setApp({ ...app, demoRowLimit: Number(e.target.value) })} /></div>
        <div><label className="lbl">Max upload size (MB, advisory)</label><input className="input" type="number" value={app.maxUploadMB} onChange={(e) => setApp({ ...app, maxUploadMB: Number(e.target.value) })} /></div>
        <div><label className="lbl">Standard sync processing target (rows)</label><input className="input" type="number" value={app.standardProcessingTargetRows} onChange={(e) => setApp({ ...app, standardProcessingTargetRows: Number(e.target.value) })} /></div>
        {[["maintenanceMode", "Maintenance mode (blocks registration)"], ["registrationOpen", "Registration open"], ["trialsEnabled", "Trials enabled"]].map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!app[k]} onChange={(e) => setApp({ ...app, [k]: e.target.checked })} />{l}</label>
        ))}
        <div><label className="lbl">Allowed formats (comma-separated, display policy)</label><input className="input" value={(app.allowedFormats || []).join(",")} onChange={(e) => setApp({ ...app, allowedFormats: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} /></div>
        <button className="btn btn-primary" onClick={() => saveKey("app", app, "App settings saved (audited)")}>Save settings</button>
      </div>
      <div className="card p-4 space-y-2.5">
        <p className="font-bold text-[14px]">Feature flags</p>
        {Object.entries(flags || {}).map(([k, v]) => (
          <label key={k} className="flex items-center gap-2 text-[13px] capitalize"><input type="checkbox" checked={!!v} onChange={(e) => setFlags({ ...flags, [k]: e.target.checked })} />{k.replace(/([A-Z])/g, " $1")}</label>
        ))}
        <button className="btn btn-primary" onClick={() => saveKey("featureFlags", flags, "Feature flags saved")}>Save flags</button>
        <p className="muted text-[11.5px]">Flags are persisted and read by the public API (demo/registration gating is enforced server-side). Module-level flags serve as staged-rollout switches for upcoming gating.</p>
      </div>
      <div className="card p-4 space-y-3">
        <p className="font-bold text-[14px]">Provider status (display labels)</p>
        {Object.keys(providers || {}).map((k) => (
          <div key={k}><label className="lbl capitalize">{k.replace(/([A-Z])/g, " $1")}</label><input className="input" value={providers[k]} onChange={(e) => setProviders({ ...providers, [k]: e.target.value })} /></div>
        ))}
        <button className="btn btn-primary" onClick={() => saveKey("providers", providers, "Provider labels saved")}>Save</button>
        <p className="muted text-[11.5px]"><b>Secrets never live here.</b> API keys, SMTP credentials and the app database URL are configured via server environment variables (see README → Configuration). Actual provider state is verified in System Health.</p>
      </div>
    </div>
  );
}

function HealthTab({ data, reload, toast, me }: any) {
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <p className="font-bold text-[15px]">System diagnostics</p>
          <span className="muted text-[12px]">{data.version} · checked {fmtDateTime(data.checkedAt)}</span>
          <button className="btn btn-primary btn-sm ml-auto" onClick={reload}>Re-run all checks</button>
        </div>
        {data.checks.map((c: any) => (
          <div key={c.name} className="flex items-start gap-3 py-2.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
            <span className={`badge ${c.status === "pass" ? "b-emerald" : c.status === "warn" ? "b-amber" : "b-red"}`}>{c.status}</span>
            <div className="flex-1"><p className="font-semibold text-[13.5px]">{c.name}</p><p className="muted text-[12.5px]">{c.detail}</p></div>
            <span className="muted text-[11.5px]">{c.ms} ms</span>
          </div>
        ))}
        <p className="muted text-[11.5px] mt-3">Each check executes a real operation (database query / env inspection) at request time. No connection strings or secrets are displayed.</p>
      </div>
      {me.role === "super_admin" && (
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1"><p className="font-bold text-[13.5px]">Demo account reset</p><p className="muted text-[12px]">Restores the seeded demo workspace dataset to the pristine 100 rows and clears its cleaning history. Touches no other data.</p></div>
          <button className="btn btn-ghost" onClick={async () => { const r = await post("/api/admin", { resource: "seed", action: "reseedDemo" }); toast(`Demo dataset reset to ${r.rows} rows`); }}>Reset demo dataset</button>
        </div>
      )}
    </div>
  );
}

function JobsTab({ data }: any) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card overflow-hidden"><p className="font-bold text-[13.5px] px-4 pt-3">Background/tracked jobs</p>
        <div className="overflow-auto max-h-[500px]"><table className="data"><thead><tr><th>Type</th><th>Status</th><th>When</th><th>Result</th></tr></thead>
          <tbody>{data.jobs.map((j: any) => <tr key={j.id}><td className="capitalize font-semibold">{j.type}</td><td><span className={`badge ${j.status === "completed" ? "b-emerald" : "b-red"}`}>{j.status}</span></td><td>{fmtDateTime(j.createdAt)}</td><td className="muted">{JSON.stringify(j.result || {}).slice(0, 60)}</td></tr>)}</tbody></table></div></div>
      <div className="card overflow-hidden"><p className="font-bold text-[13.5px] px-4 pt-3">Automation runs</p>
        <div className="overflow-auto max-h-[500px]"><table className="data"><thead><tr><th>Status</th><th>Started</th><th>Log</th></tr></thead>
          <tbody>{data.runs.map((r: any) => <tr key={r.id}><td><span className={`badge ${r.status === "completed" ? "b-emerald" : "b-red"}`}>{r.status}</span></td><td>{fmtDateTime(r.startedAt)}</td><td className="muted">{(r.log || []).length} entries</td></tr>)}</tbody></table></div></div>
    </div>
  );
}

function AuditTab({ data, search }: any) {
  const rows = data.audit.filter((a: any) => !search || `${a.action} ${a.actorEmail} ${a.entity}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="card overflow-hidden"><div className="overflow-auto max-h-[620px]"><table className="data"><thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Entity</th><th>Metadata</th></tr></thead>
    <tbody>{rows.map((a: any) => <tr key={a.id}><td>{fmtDateTime(a.createdAt)}</td><td className="font-semibold">{a.action}</td><td>{a.actorEmail}</td><td className="muted">{a.entity} {a.entityId?.slice(0, 8)}</td><td className="muted">{JSON.stringify(a.metadata || {}).slice(0, 80)}</td></tr>)}</tbody></table></div></div>;
}
