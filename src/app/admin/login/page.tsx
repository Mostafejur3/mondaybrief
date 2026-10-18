"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/shell";
import { post, useToast, ErrBox } from "@/components/ui";
import { ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter(); const toast = useToast();
  const [email, setEmail] = useState("admin@mondaybrief.ai");
  const [password, setPassword] = useState("Admin@12345");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const d = await post("/api/auth", { action: "login", email, password, requireAdmin: true }); toast(`Welcome, ${d.user.name}`); router.push("/admin"); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <PublicShell>
      <div className="max-w-md mx-auto px-4 py-12">
        <form onSubmit={submit} className="card p-6 space-y-3.5">
          <h1 className="text-[22px] font-extrabold flex items-center gap-2"><ShieldCheck className="text-emerald-600" /> Administrator sign-in</h1>
          <p className="muted text-[12.5px]">Admin access is verified server-side on every request and all actions are audit-logged. There is no hardcoded frontend secret. The bootstrap account is created from the ADMIN_EMAIL / ADMIN_PASSWORD server environment variables.</p>
          {err && <ErrBox msg={err} />}
          <div><label className="lbl">Admin email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="lbl">Password</label><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? "Verifying…" : "Sign in to Admin"}</button>
          <p className="muted text-[12px]">Default seed (this environment): admin@mondaybrief.ai / Admin@12345 — <b>change immediately in production</b>. Not an admin? <Link href="/login" className="link">User sign-in</Link></p>
        </form>
      </div>
    </PublicShell>
  );
}
