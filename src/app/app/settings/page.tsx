"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, ErrBox, Confirm, download } from "@/components/ui";
import { Download, LogOut } from "lucide-react";

export default function Settings() {
  const session = useSession(); const toast = useToast(); const router = useRouter();
  const [form, setForm] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<any>({ support: true, billing: true, alerts: true, announcements: true });

  useEffect(() => {
    if (session.user) { setForm({ ...session.user }); post("/api/auth", { action: "sessions" }).then((d) => setSessions(d.sessions)).catch(() => {}); }
  }, [session.user]);

  const saveProfile = async () => {
    try { const d = await post("/api/auth", { action: "updateProfile", ...form, preferences: { notifications: notifPrefs } }); toast("Profile saved");
      localStorage.setItem("mb_theme", form.theme); document.documentElement.classList.toggle("dark", form.theme === "dark"); }
    catch (e: any) { toast(e.message, "error"); }
  };
  const exportAccount = async () => {
    const data = { user: session.user, exportedAt: new Date().toISOString(), workspaces: session.workspaces.map((w: any) => ({ id: w.id, name: w.name, role: w.myRole })) };
    download("mondaybrief-account-export.json", JSON.stringify(data, null, 2), "application/json");
    toast("Account export downloaded (dataset CSVs are in Team → Export all datasets)");
  };

  if (session.loading || !session.user || !form) return <div className="p-8"><Spinner /></div>;
  return (
    <AppShell session={session} title="Profile & Security" subtitle="Preferences are stored on your account and applied across workspaces. Password changes and session revocation take effect immediately.">
      {err && <ErrBox msg={err} />}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4 space-y-3">
          <p className="font-bold text-[14px]">Profile</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="lbl">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="lbl">Email (login identity)</label><input className="input" value={form.email} disabled title="Email changes require re-verification — contact support" /></div>
            <div><label className="lbl">Company</label><input className="input" value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div><label className="lbl">Job title</label><input className="input" value={form.jobTitle || ""} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></div>
            <div><label className="lbl">Language</label><select className="select" value={form.language || "en"} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="en">English</option><option value="ar" disabled>العربية (roadmap)</option><option value="de" disabled>Deutsch (roadmap)</option></select></div>
            <div><label className="lbl">Timezone</label><select className="select" value={form.timezone || "UTC"} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>{["UTC", "Europe/London", "Europe/Berlin", "Africa/Cairo", "Asia/Dubai", "Asia/Karachi", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Singapore", "Australia/Sydney"].map((t) => <option key={t}>{t}</option>)}</select></div>
            <div><label className="lbl">Theme</label><select className="select" value={form.theme || "light"} onChange={(e) => setForm({ ...form, theme: e.target.value })}><option value="light">Light</option><option value="dark">Dark</option></select></div>
            <div><label className="lbl">Account</label><p className="text-[12.5px] muted">Role: {form.role} · Email verified: {form.emailVerified ? "yes" : "no (provider not configured)"}<br />Member since {new Date(form.createdAt).toLocaleDateString()}</p></div>
          </div>
          <div><label className="lbl">Notification preferences (stored; email delivery needs a configured provider)</label>
            <div className="flex flex-wrap gap-3">{Object.keys(notifPrefs).map((k) => <label key={k} className="flex items-center gap-1.5 text-[13px] capitalize"><input type="checkbox" checked={notifPrefs[k]} onChange={(e) => setNotifPrefs({ ...notifPrefs, [k]: e.target.checked })} />{k}</label>)}</div></div>
          <button className="btn btn-primary" onClick={saveProfile}>Save profile</button>
        </div>

        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <p className="font-bold text-[14px]">Change password</p>
            <div><label className="lbl">Current password</label><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
            <div><label className="lbl">New password (min. 8)</label><input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
            <button className="btn btn-primary btn-sm" onClick={async () => { try { await post("/api/auth", { action: "changePassword", ...pw }); toast("Password changed"); setPw({ current: "", next: "" }); } catch (e: any) { toast(e.message, "error"); } }}>Change password</button>
            <p className="muted text-[11.5px]">Multi-factor authentication is not yet available in this build — it is on the security roadmap (prioritized for admin accounts). Use a unique, strong password.</p>
          </div>
          <div className="card p-4">
            <p className="font-bold text-[14px] mb-2">Active sessions</p>
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-1.5 text-[12px] border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <span className={`badge ${s.active ? "b-emerald" : "b-slate"}`}>{s.active ? "active" : "ended"}</span>
                <span className="muted truncate flex-1">{new Date(s.createdAt).toLocaleString()} · {s.ip || "unknown IP"} · {(s.userAgent || "").slice(0, 40)}…</span>
                {s.active && <button className="btn btn-ghost btn-sm" onClick={async () => { await post("/api/auth", { action: "revokeSession", id: s.id }); toast("Session revoked", "info"); post("/api/auth", { action: "sessions" }).then((d) => setSessions(d.sessions)); }}><LogOut size={12} /> Revoke</button>}
              </div>
            ))}
          </div>
          <div className="card p-4">
            <p className="font-bold text-[14px] mb-2">Data & account</p>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-ghost btn-sm" onClick={exportAccount}><Download size={13} /> Export account data (JSON)</button>
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>Delete my account</button>
            </div>
            <p className="muted text-[11.5px] mt-2">Deletion removes your account and workspaces you own (with all their data). Shared workspaces you merely belong to are unaffected.</p>
          </div>
        </div>
      </div>
      <Confirm open={confirmDelete} onClose={() => setConfirmDelete(false)} danger title="Delete your account permanently?"
        body="Enter your password below (in the field after closing is not possible — type it in the prompt field on the next step). This deletes owned workspaces and all their data."
        onConfirm={async () => {
          const p = prompt("Enter your password to confirm account deletion:");
          if (!p) return;
          try { await post("/api/auth", { action: "deleteAccount", password: p }); toast("Account deleted", "info"); router.push("/"); }
          catch (e: any) { toast(e.message, "error"); }
        }} />
    </AppShell>
  );
}
