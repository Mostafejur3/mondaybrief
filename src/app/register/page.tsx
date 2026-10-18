"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicShell } from "@/components/shell";
import { post, useToast, ErrBox } from "@/components/ui";

export default function Register() {
  const router = useRouter(); const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", company: "", password: "", confirm: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    if (form.password !== form.confirm) { setErr("Passwords don't match."); return; }
    if (form.password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setBusy(true);
    try { const d = await post("/api/auth", { action: "register", ...form }); toast("Account created — welcome to MondayBrief AI"); if (d.note) toast(d.note, "info"); router.push("/app"); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  return (
    <PublicShell>
      <div className="max-w-md mx-auto px-4 py-12">
        <form onSubmit={submit} className="card p-6 space-y-3.5">
          <h1 className="text-[22px] font-extrabold">Create your free account</h1>
          <p className="muted text-[13px]">Free plan: 3 datasets up to 1,000 rows each, 2 dashboards, 10 AI questions/month. No card required.</p>
          {err && <ErrBox msg={err} />}
          <div><label className="lbl">Full name *</label><input className="input" required value={form.name} onChange={set("name")} autoComplete="name" /></div>
          <div><label className="lbl">Work email *</label><input className="input" type="email" required value={form.email} onChange={set("email")} autoComplete="email" /></div>
          <div><label className="lbl">Company (optional)</label><input className="input" value={form.company} onChange={set("company")} autoComplete="organization" /></div>
          <div><label className="lbl">Password * (min. 8 characters)</label><input className="input" type="password" required value={form.password} onChange={set("password")} autoComplete="new-password" /></div>
          <div><label className="lbl">Confirm password *</label><input className="input" type="password" required value={form.confirm} onChange={set("confirm")} autoComplete="new-password" /></div>
          <button className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
          <p className="muted text-[11.5px]">By registering you agree to the <Link href="/legal#terms" className="link">Terms</Link> and <Link href="/legal#privacy" className="link">Privacy Policy</Link>. Already have an account? <Link href="/login" className="link">Log in</Link></p>
        </form>
      </div>
    </PublicShell>
  );
}
