"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/shell";
import { post, useToast, ErrBox } from "@/components/ui";

export default function Login() {
  const router = useRouter(); const toast = useToast();
  const [email, setEmail] = useState("demo@mondaybrief.ai");
  const [password, setPassword] = useState("Demo@12345");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const d = await post("/api/auth", { action: "login", email, password }); toast(`Welcome back, ${d.user.name}`); router.push(["admin", "super_admin"].includes(d.user.role) ? "/app" : "/app"); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <PublicShell>
      <div className="max-w-md mx-auto px-4 py-12">
        <form onSubmit={submit} className="card p-6 space-y-3.5">
          <h1 className="text-[22px] font-extrabold">Log in</h1>
          <p className="muted text-[13px]">New here? <Link href="/register" className="link">Create a free account</Link> · Just exploring? <Link href="/demo" className="link">Open the demo</Link></p>
          {err && <ErrBox msg={err} />}
          <div><label className="lbl">Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <div><label className="lbl">Password</label><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
          <button className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? "Signing in…" : "Log in"}</button>
          <div className="flex justify-between text-[12.5px]"><Link href="/forgot" className="link">Forgot password?</Link><Link href="/admin/login" className="link">Administrator sign-in</Link></div>
          <div className="rounded-lg p-3 text-[12px]" style={{ background: "var(--surface2)" }}>
            <b>Seeded demo account</b> (this environment): demo@mondaybrief.ai / Demo@12345 — includes the 100-row sample workspace, dashboard, invoice and support thread.
          </div>
        </form>
      </div>
    </PublicShell>
  );
}
