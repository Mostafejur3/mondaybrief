"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, post, useToast, useTheme } from "./ui";
import {
  Sparkles, LayoutDashboard, Database, Wand2, BarChart3, MessageSquareText, CircleHelp, Gauge,
  FileText, Workflow, Plug, CreditCard, Bell, LifeBuoy, Users, Settings, LogOut, Menu, X,
  Sun, Moon, Search, ChevronDown, ShieldCheck, Home, PlayCircle, BookOpen, Mail, Info, Scale, Activity,
} from "lucide-react";

export const Logo = ({ light }: { light?: boolean }) => (
  <Link href="/" className="flex items-center gap-2.5">
    <span className="w-8 h-8 rounded-[9px] flex items-center justify-center text-white shadow" style={{ background: "linear-gradient(135deg,#059669,#0d9488)" }}><Sparkles size={17} /></span>
    <span className={`font-extrabold tracking-tight text-[16px] ${light ? "text-white" : ""}`}>MondayBrief <span className="text-emerald-500">AI</span></span>
  </Link>
);

/* ---------------- Public shell ---------------- */
export function PublicShell({ children }: { children: ReactNode }) {
  const [cms, setCms] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useTheme();
  useEffect(() => { api("/api/public").then((d) => setCms(d.cms)).catch(() => {}); api("/api/auth").then((d) => setMe(d.user)).catch(() => {}); }, []);
  const nav = [["Features", "/features"], ["Pricing", "/pricing"], ["Demo", "/demo"], ["Docs", "/docs"], ["Security", "/security"], ["About", "/about"], ["Contact", "/contact"]];
  return (
    <div className="min-h-screen flex flex-col">
      {cms?.announcement && <div className="text-center text-[12px] font-semibold text-white py-1.5 px-3" style={{ background: "linear-gradient(90deg,#065f46,#0d9488)" }}>{cms.announcement} <Link href="/demo" className="underline ml-1">Open demo →</Link></div>}
      <header className="glass sticky top-0 z-50 border-b">
        <div className="max-w-7xl mx-auto px-4 h-[58px] flex items-center gap-6">
          <Logo />
          <nav className="hidden lg:flex items-center gap-1 text-[13.5px] font-medium">
            {nav.map(([l, h]) => <Link key={h} href={h} className="px-2.5 py-1.5 rounded-lg hover:bg-black/5">{l}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggle} className="btn btn-ghost btn-sm" aria-label="Toggle theme">{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
            {me ? (<><Link href="/app" className="btn btn-primary btn-sm">Go to app</Link>{["admin", "super_admin"].includes(me.role) && <Link href="/admin" className="btn btn-ghost btn-sm">Admin</Link>}</>)
              : (<><Link href="/login" className="btn btn-ghost btn-sm">Log in</Link><Link href="/register" className="btn btn-primary btn-sm">Get started free</Link></>)}
            <button className="lg:hidden btn btn-ghost btn-sm" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X size={16} /> : <Menu size={16} />}</button>
          </div>
        </div>
        {open && <nav className="lg:hidden px-4 pb-3 flex flex-col">{nav.map(([l, h]) => <Link key={h} href={h} onClick={() => setOpen(false)} className="py-2 text-[14px] font-medium border-b" style={{ borderColor: "var(--border)" }}>{l}</Link>)}</nav>}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-16" style={{ background: "var(--sidebar)", color: "var(--sidebar-text)" }}>
        <div className="max-w-7xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4 text-[13px]">
          <div><Logo light /><p className="mt-3 opacity-80">{cms?.footerNote || "From messy data to meaningful decisions."}</p><p className="mt-2 opacity-60">Transparent data cleaning, explainable AI analysis, customizable dashboards.</p></div>
          <div><p className="font-bold text-white mb-2.5">Product</p>{[["Features", "/features"], ["Interactive demo", "/demo"], ["Pricing", "/pricing"], ["Documentation", "/docs"], ["Service status", "/status"]].map(([l, h]) => <Link key={h} href={h} className="block py-1 opacity-85 hover:opacity-100">{l}</Link>)}</div>
          <div><p className="font-bold text-white mb-2.5">Company</p>{[["About", "/about"], ["Contact & support", "/contact"], ["Security & privacy", "/security"], ["Admin sign-in", "/admin/login"]].map(([l, h]) => <Link key={h} href={h} className="block py-1 opacity-85 hover:opacity-100">{l}</Link>)}</div>
          <div><p className="font-bold text-white mb-2.5">Legal</p>{[["Terms of service", "/legal#terms"], ["Privacy policy", "/legal#privacy"], ["Cookie preferences", "/legal#cookies"]].map(([l, h]) => <Link key={h} href={h} className="block py-1 opacity-85 hover:opacity-100">{l}</Link>)}
            <p className="mt-3 opacity-60">Support: {cms?.supportEmail || "support@mondaybrief.example"}</p></div>
        </div>
        <div className="border-t border-white/10 py-3 text-center text-[12px] opacity-60">© {new Date().getFullYear()} MondayBrief AI. Demo data on this site is fictional and labelled as such.</div>
      </footer>
    </div>
  );
}

/* ---------------- App / Admin shell ---------------- */
const APP_NAV: [string, { icon: any; label: string; href: string }[]][] = [
  ["Workspace", [
    { icon: Home, label: "Overview", href: "/app" },
    { icon: Database, label: "Data Hub", href: "/app/data" },
    { icon: Wand2, label: "Cleaning Studio", href: "/app/data?tab=files" },
    { icon: BarChart3, label: "Analysis", href: "/app/analysis" },
    { icon: Gauge, label: "Dashboards", href: "/app/dashboards" },
  ]],
  ["Intelligence", [
    { icon: MessageSquareText, label: "AI Business Analyst", href: "/app/analyst" },
    { icon: CircleHelp, label: "Business Questions", href: "/app/questions" },
    { icon: FileText, label: "Reports", href: "/app/reports" },
    { icon: Workflow, label: "Automations & Alerts", href: "/app/automations" },
    { icon: Plug, label: "Integrations", href: "/app/integrations" },
  ]],
  ["Account", [
    { icon: CreditCard, label: "Usage & Billing", href: "/app/billing" },
    { icon: Bell, label: "Notifications", href: "/app/notifications" },
    { icon: LifeBuoy, label: "Support Center", href: "/app/support" },
    { icon: Users, label: "Team & Workspace", href: "/app/team" },
    { icon: Settings, label: "Profile & Security", href: "/app/settings" },
  ]],
];

export function useSession(redirect = true) {
  const [user, setUser] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [wsId, setWsId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    api("/api/auth").then(async (d) => {
      if (!d.user) { if (redirect) router.push("/login"); setLoading(false); return; }
      setUser(d.user);
      const w = await api("/api/work?resource=workspaces");
      setWorkspaces(w.workspaces || []);
      const saved = localStorage.getItem("mb_ws");
      setWsId((w.workspaces || []).some((x: any) => x.id === saved) ? saved : w.workspaces?.[0]?.id || "");
      setLoading(false);
    }).catch(() => { if (redirect) router.push("/login"); setLoading(false); });
  }, [router, redirect]);
  const switchWs = (id: string) => { setWsId(id); localStorage.setItem("mb_ws", id); };
  return { user, workspaces, wsId, switchWs, loading, ws: workspaces.find((w) => w.id === wsId) };
}

export function AppShell({ children, title, subtitle, session, actions }: { children: ReactNode; title: string; subtitle?: string; session: ReturnType<typeof useSession>; actions?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { dark, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [showN, setShowN] = useState(false);
  const [search, setSearch] = useState("");
  const user = session.user;
  useEffect(() => { if (user) api("/api/work?resource=notifications").then((d) => setNotifs(d.notifications || [])).catch(() => {}); }, [user, pathname]);
  const unread = notifs.filter((n) => !n.readAt).length;
  const logout = async () => { await post("/api/auth", { action: "logout" }).catch(() => {}); router.push("/login"); toast("Signed out", "info"); };
  const markRead = async () => { await post("/api/work", { resource: "notifications", action: "readAll" }); setNotifs(notifs.map((n) => ({ ...n, readAt: new Date().toISOString() }))); };
  const flat = APP_NAV.flatMap(([, items]) => items);
  const results = search.trim() ? flat.filter((i) => i.label.toLowerCase().includes(search.toLowerCase())) : [];
  const sidebar = (
    <div className="h-full flex flex-col" style={{ background: "var(--sidebar)" }}>
      <div className="px-3.5 py-3.5 border-b border-white/10"><Logo light /></div>
      <div className="px-3 py-2.5">
        <label className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-200/60">Workspace</label>
        <select className="select mt-1 !bg-white/10 !text-white !border-white/15 text-[13px]" value={session.wsId} onChange={(e) => session.switchWs(e.target.value)} aria-label="Switch workspace">
          {session.workspaces.map((w) => <option key={w.id} value={w.id} className="text-slate-900">{w.name}</option>)}
        </select>
        {session.ws && <p className="text-[11px] mt-1 text-emerald-100/70 capitalize">{session.ws.myRole} · {session.ws.planId} plan</p>}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {APP_NAV.map(([group, items]) => (
          <div key={group} className="mt-3">
            {!collapsed && <p className="px-2 text-[10.5px] font-bold uppercase tracking-wider text-emerald-200/50 mb-1">{group}</p>}
            {items.map((i) => {
              const base = i.href.split("?")[0];
              const active = i.href === "/app" ? pathname === "/app" : pathname.startsWith(base) && base !== "/app/data" ? true : pathname === base || pathname.startsWith(base + "/");
              return <Link key={i.label} href={i.href} onClick={() => setMobile(false)} className={`navitem ${active ? "active" : ""}`} title={i.label}><i.icon size={16} className="shrink-0" />{!collapsed && <span>{i.label}</span>}{i.label === "Notifications" && unread > 0 && !collapsed && <span className="badge b-red ml-auto">{unread}</span>}</Link>;
            })}
          </div>
        ))}
        {user && ["admin", "super_admin"].includes(user.role) && (
          <div className="mt-4"><Link href="/admin" className="navitem"><ShieldCheck size={16} />{!collapsed && "Admin Control Center"}</Link></div>
        )}
      </nav>
      <div className="p-3 border-t border-white/10">
        <Link href="/demo" className="navitem"><PlayCircle size={16} />{!collapsed && "Public demo"}</Link>
        <Link href="/docs" className="navitem"><BookOpen size={16} />{!collapsed && "Help & docs"}</Link>
        <button onClick={() => setCollapsed(!collapsed)} className="navitem w-full hidden md:flex"><Menu size={16} />{!collapsed && "Collapse"}</button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen flex">
      <aside className={`hidden md:block shrink-0 sticky top-0 h-screen ${collapsed ? "w-[64px]" : "w-[238px]"}`}>{sidebar}</aside>
      {mobile && <div className="fixed inset-0 z-[120] md:hidden"><div className="absolute inset-0 bg-black/50" onClick={() => setMobile(false)} /><aside className="relative w-[250px] h-full">{sidebar}</aside></div>}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="glass sticky top-0 z-[60] border-b h-[56px] flex items-center gap-2 px-3 sm:px-5">
          <button className="md:hidden btn btn-ghost btn-sm" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu size={16} /></button>
          <div className="relative hidden sm:block w-[230px]">
            <Search size={14} className="absolute left-2.5 top-[9px] muted" />
            <input className="input pl-8" placeholder="Search pages…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Global search" />
            {results.length > 0 && <div className="absolute top-10 left-0 right-0 card p-1.5 shadow-xl z-50">{results.map((r) => <Link key={r.label} href={r.href} onClick={() => setSearch("")} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/5 text-[13px]"><r.icon size={14} />{r.label}</Link>)}</div>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={toggle} className="btn btn-ghost btn-sm" aria-label="Toggle theme">{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
            <div className="relative">
              <button className="btn btn-ghost btn-sm relative" onClick={() => setShowN(!showN)} aria-label="Notifications"><Bell size={15} />{unread > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center">{unread}</span>}</button>
              {showN && (<div className="absolute right-0 top-10 w-[330px] card shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}><b className="text-[13px]">Notifications</b><button className="link text-[12px]" onClick={markRead}>Mark all read</button></div>
                <div className="max-h-[300px] overflow-y-auto">{notifs.length === 0 ? <p className="p-4 text-[13px] muted">No notifications yet.</p> : notifs.slice(0, 12).map((n) => (
                  <Link key={n.id} href={n.link || "/app/notifications"} onClick={() => setShowN(false)} className={`block px-3.5 py-2.5 border-b text-[12.5px] ${!n.readAt ? "bg-emerald-50/70 dark:bg-emerald-950/30" : ""}`} style={{ borderColor: "var(--border)" }}>
                    <b>{n.title}</b><p className="muted mt-0.5">{n.body}</p></Link>))}</div>
              </div>)}
            </div>
            {user && (<div className="flex items-center gap-2 pl-1">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: "linear-gradient(135deg,#059669,#0d9488)" }}>{user.name.split(" ").map((x: string) => x[0]).slice(0, 2).join("")}</span>
              <span className="hidden xl:block leading-tight"><span className="block text-[12.5px] font-bold">{user.name}</span><span className="block text-[11px] muted capitalize">{user.role.replace("_", " ")}</span></span>
              <button onClick={logout} className="btn btn-ghost btn-sm" aria-label="Sign out"><LogOut size={15} /></button>
            </div>)}
          </div>
        </header>
        <main className="p-3.5 sm:p-5 max-w-[1500px] w-full mx-auto">
          <div className="flex flex-wrap items-start gap-3 mb-4">
            <div><h1 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">{title}</h1>{subtitle && <p className="muted text-[13px] mt-0.5 max-w-2xl">{subtitle}</p>}</div>
            {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
          </div>
          {children}
        </main>
        <footer className="px-5 py-3 text-[11.5px] muted flex flex-wrap gap-3 border-t" style={{ borderColor: "var(--border)" }}>
          <span>MondayBrief AI</span><Link href="/status" className="hover:underline flex items-center gap-1"><Activity size={11} /> Status</Link>
          <Link href="/legal" className="hover:underline flex items-center gap-1"><Scale size={11} /> Legal</Link>
          <Link href="/contact" className="hover:underline flex items-center gap-1"><Mail size={11} /> Contact</Link>
          <span className="ml-auto">All analytics are computed deterministically from your rows.</span>
        </footer>
      </div>
    </div>
  );
}

export const PageHead = ({ title, sub }: { title: string; sub: string }) => (
  <div className="max-w-7xl mx-auto px-4 pt-10 pb-4"><h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{title}</h1><p className="muted mt-2 max-w-2xl text-[15px]">{sub}</p></div>
);
export const BROWSE_ICONS = { Info, LayoutDashboard, ChevronDown };
