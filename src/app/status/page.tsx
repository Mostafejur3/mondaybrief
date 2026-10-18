"use client";
import { useCallback, useEffect, useState } from "react";
import { PublicShell, PageHead } from "@/components/shell";
import { api, Spinner } from "@/components/ui";
export default function Status() {
  const [h, setH] = useState<any>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => { setErr(""); api("/api/public?health=1").then(setH).catch((e) => setErr(e.message)); }, []);
  useEffect(load, [load]);
  const row = (label: string, value: string, good: boolean) => (
    <div className="flex items-center gap-3 py-3 border-b" style={{ borderColor: "var(--border)" }}>
      <span className={`w-2.5 h-2.5 rounded-full ${good ? "bg-emerald-500" : "bg-amber-500"}`} />
      <span className="font-semibold text-[13.5px]">{label}</span><span className="ml-auto muted text-[12.5px] text-right">{value}</span>
    </div>
  );
  return (
    <PublicShell>
      <PageHead title="Service status" sub="Live checks executed against this deployment when you open the page — not a static badge." />
      <div className="max-w-3xl mx-auto px-4 pb-10">
        <div className="card p-5">
          {!h && !err ? <Spinner label="Running live checks…" /> : err ? <p className="text-red-700 text-[14px]">Status check failed: {err}</p> : (
            <>
              <p className="font-extrabold text-[17px] flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${h.status === "operational" ? "bg-emerald-500" : "bg-amber-500"}`} />{h.status === "operational" ? "All core systems operational" : "Service degraded"}</p>
              <p className="muted text-[12px] mt-1">Checked at {new Date(h.checkedAt).toLocaleString()}</p>
              <div className="mt-3">
                {row("Web application", "Serving requests", true)}
                {row("PostgreSQL database", h.dbLatencyMs !== undefined ? `Connected · ${h.dbLatencyMs} ms query latency` : "Unavailable", !!h.dbLatencyMs)}
                {row("Email delivery", h.providers?.email === "configured" ? "SMTP configured" : "Not configured in this environment (password reset uses a dev-token flow)", h.providers?.email === "configured")}
                {row("Payments", h.providers?.payments || "development mode", h.providers?.payments !== "development mode")}
                {row("AI analyst", h.providers?.ai || "built-in engine", true)}
              </div>
              <button className="btn btn-ghost btn-sm mt-4" onClick={load}>Re-run checks</button>
            </>
          )}
        </div>
        <p className="muted text-[12px] mt-3">Administrators get a deeper System Health view in Admin → Diagnostics, including schema, storage and configuration checks.</p>
      </div>
    </PublicShell>
  );
}
