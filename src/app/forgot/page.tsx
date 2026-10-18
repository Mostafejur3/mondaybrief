"use client";
import Link from "next/link";
import { useState } from "react";
import { PublicShell } from "@/components/shell";
import { post, useToast, ErrBox } from "@/components/ui";

export default function Forgot() {
  const toast = useToast();
  const [email, setEmail] = useState(""); const [token, setToken] = useState(""); const [pw, setPw] = useState("");
  const [stage, setStage] = useState<"ask" | "reset" | "done">("ask");
  const [info, setInfo] = useState<any>(null); const [err, setErr] = useState("");
  const request = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    try { const d = await post("/api/auth", { action: "forgot", email }); setInfo(d); setStage("reset"); if (d.devResetToken) setToken(d.devResetToken); }
    catch (e: any) { setErr(e.message); }
  };
  const reset = async (e: React.FormEvent) => {
    e.preventDefault(); setErr("");
    try { await post("/api/auth", { action: "reset", token, password: pw }); setStage("done"); toast("Password updated"); }
    catch (e: any) { setErr(e.message); }
  };
  return (
    <PublicShell>
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="card p-6 space-y-3.5">
          <h1 className="text-[22px] font-extrabold">Reset your password</h1>
          {err && <ErrBox msg={err} />}
          {stage === "ask" && (
            <form onSubmit={request} className="space-y-3.5">
              <p className="muted text-[13px]">Enter your account email. If an account exists, a one-time reset link is issued (valid 1 hour).</p>
              <div><label className="lbl">Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <button className="btn btn-primary w-full justify-center">Request reset</button>
            </form>
          )}
          {stage === "reset" && (
            <form onSubmit={reset} className="space-y-3.5">
              <p className="text-[13px]">{info?.message}</p>
              {info?.devNote && <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-[12px] p-3">{info.devNote}</div>}
              <div><label className="lbl">Reset token</label><input className="input" required value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token from the email" /></div>
              <div><label className="lbl">New password (min. 8)</label><input className="input" type="password" required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></div>
              <button className="btn btn-primary w-full justify-center">Set new password</button>
            </form>
          )}
          {stage === "done" && <p className="text-[13.5px]">Password updated and all sessions signed out. <Link href="/login" className="link">Log in with your new password →</Link></p>}
        </div>
      </div>
    </PublicShell>
  );
}
