"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, ErrBox, Confirm, Meter, money, fmtDateOnly } from "@/components/ui";
import { CheckCircle2, CreditCard, Download } from "lucide-react";

export default function Billing() {
  const session = useSession(); const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [confirmPlan, setConfirmPlan] = useState<any>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [openInvoice, setOpenInvoice] = useState<any>(null);

  const load = useCallback(async () => {
    if (!session.wsId) return;
    try { setData(await api(`/api/work?resource=billing&workspaceId=${session.wsId}`)); } catch (e: any) { setErr(e.message); }
  }, [session.wsId]);
  useEffect(() => { load(); }, [load]);

  const subscribe = async () => {
    try { const r = await post("/api/work", { resource: "billing", action: "subscribe", workspaceId: session.wsId, planId: confirmPlan.id, cycle }); toast(r.note || "Plan updated"); setConfirmPlan(null); load(); }
    catch (e: any) { toast(e.message, "error"); }
  };
  const printInvoice = (inv: any) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>${inv.number}</title><style>body{font-family:system-ui;margin:40px;color:#12211b}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;font-size:13px}.r{text-align:right}</style></head><body>
      <h1 style="font-size:20px">MondayBrief AI — Invoice ${inv.number}</h1>
      <p>Issued: ${fmtDateOnly(inv.issuedAt)} · Status: <b>${inv.status}</b> · Provider: ${inv.provider}${inv.provider === "development" ? " (development billing record — no real charge was made)" : ""}</p>
      <p>Bill to: ${session.user.name} (${session.user.email})</p>
      <table><tr><th>Description</th><th class="r">Amount</th></tr>${(inv.lines || []).map((l: any) => `<tr><td>${l.description}</td><td class="r">${money(l.amount)}</td></tr>`).join("")}
      <tr><td><b>Total</b></td><td class="r"><b>${money(inv.amount)} ${inv.currency}</b></td></tr></table>
      <p style="color:#666;font-size:12px">Period: ${inv.periodStart ? fmtDateOnly(inv.periodStart) : "—"} → ${inv.periodEnd ? fmtDateOnly(inv.periodEnd) : "—"}. Tax treatment depends on the operator's configuration; no tax identifiers are invented here.</p>
      <script>window.print()<\/script></body></html>`);
  };

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  const limits = data?.currentPlan?.limits || {};
  return (
    <AppShell session={session} title="Usage & Billing" subtitle="Plan limits are enforced server-side (dataset rows, counts, AI questions). Subscription state always comes from billing records — never from the frontend.">
      {err && <ErrBox msg={err} />}
      {!data ? <Spinner /> : (
        <div className="space-y-4">
          {data.billingMode === "development" && <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-[13px] px-4 py-3"><b>Development billing mode:</b> no payment provider is connected, so plan changes are recorded locally and <b>no real charge occurs</b>. Invoices are labelled accordingly. Configure Stripe (Docs → Billing) for live payments.</div>}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="font-bold text-[14px] flex items-center gap-2"><CreditCard size={16} className="text-emerald-600" /> Current plan</p>
              <p className="text-[24px] font-extrabold mt-1.5">{data.currentPlan?.name || "Free"}</p>
              {data.subscription ? <p className="muted text-[12.5px]">Status: <b>{data.subscription.status}</b> · {data.subscription.billingCycle} · renews/ends {data.subscription.currentPeriodEnd ? fmtDateOnly(data.subscription.currentPeriodEnd) : "—"}{data.subscription.cancelAtPeriodEnd ? " · cancellation scheduled" : ""}<br />Provider: {data.subscription.provider}</p> : <p className="muted text-[12.5px]">Free plan — no subscription record.</p>}
              {data.subscription?.status === "active" && !data.subscription.cancelAtPeriodEnd && <button className="btn btn-ghost btn-sm mt-3 !text-red-600" onClick={() => setConfirmCancel(true)}>Cancel subscription</button>}
            </div>
            <div className="card p-4 lg:col-span-2 space-y-3">
              <p className="font-bold text-[14px]">Usage — {session.ws?.name}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Meter value={data.usage.datasets || 0} max={Number(limits.maxDatasets || 3)} label="Datasets" />
                <Meter value={data.usage.dashboards || 0} max={Number(limits.maxDashboards || 2)} label="Dashboards" />
                <Meter value={data.usage.reports || 0} max={Number(limits.maxReports || 2)} label="Reports" />
                <Meter value={data.usage.aiQuestionsThisWorkspace || 0} max={Number(limits.aiQuestionsPerMonth || 10)} label="AI questions (workspace total)" />
              </div>
              <p className="muted text-[12px]">Rows stored: {(data.usage.rowsStored || 0).toLocaleString()} · Row limit per dataset: {Number(limits.maxRowsPerDataset || 0).toLocaleString()} · Max file size: {limits.maxFileSizeMB} MB</p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3"><p className="font-extrabold text-[16px]">Plans</p>
              <div className="ml-auto flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                {(["monthly", "yearly"] as const).map((c) => <button key={c} onClick={() => setCycle(c)} className={`px-3 py-1 text-[12.5px] font-bold capitalize ${cycle === c ? "text-white" : ""}`} style={cycle === c ? { background: "var(--brand)" } : {}}>{c}</button>)}
              </div></div>
            <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3">
              {data.plans.map((p: any) => {
                const current = data.currentPlan?.id === p.id;
                return (
                  <div key={p.id} className={`card p-4 flex flex-col ${current ? "ring-2 ring-emerald-500" : ""}`}>
                    <p className="font-extrabold">{p.name}</p><p className="muted text-[11.5px]">{p.tagline}</p>
                    <p className="mt-2">{p.id === "enterprise" ? <b className="text-[18px]">Custom</b> : <><b className="text-[22px]">{money(cycle === "yearly" ? p.priceYearly : p.priceMonthly).replace(".00", "")}</b><span className="muted text-[11.5px]">/{cycle === "yearly" ? "yr" : "mo"}</span></>}</p>
                    <ul className="mt-2 space-y-1 flex-1">{(p.features || []).slice(0, 5).map((f: string) => <li key={f} className="flex gap-1 text-[11.5px]"><CheckCircle2 size={12} className="text-emerald-600 shrink-0 mt-0.5" />{f}</li>)}</ul>
                    {current ? <span className="badge b-emerald mt-3 self-start">Current plan</span>
                      : p.id === "enterprise" ? <a href="/contact" className="btn btn-ghost btn-sm mt-3 justify-center">Contact sales</a>
                      : <button className="btn btn-primary btn-sm mt-3 justify-center" onClick={() => setConfirmPlan(p)}>Switch to {p.name}</button>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card overflow-hidden">
            <p className="font-bold text-[14px] px-4 pt-3.5">Invoices</p>
            <div className="overflow-x-auto"><table className="data"><thead><tr><th>Number</th><th>Issued</th><th>Period</th><th>Amount</th><th>Status</th><th>Provider</th><th></th></tr></thead>
              <tbody>{data.invoices.length === 0 ? <tr><td colSpan={7} className="text-center muted py-5">No invoices yet.</td></tr> : data.invoices.map((inv: any) => (
                <tr key={inv.id}><td className="font-semibold">{inv.number}</td><td>{fmtDateOnly(inv.issuedAt)}</td>
                  <td>{inv.periodStart ? fmtDateOnly(inv.periodStart) : "—"} → {inv.periodEnd ? fmtDateOnly(inv.periodEnd) : "—"}</td>
                  <td>{money(inv.amount)} {inv.currency}</td><td><span className={`badge ${inv.status === "paid" ? "b-emerald" : inv.status === "open" ? "b-amber" : "b-slate"}`}>{inv.status}</span></td><td>{inv.provider}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => printInvoice(inv)}><Download size={12} /> PDF</button></td></tr>
              ))}</tbody></table></div>
          </div>
        </div>
      )}
      <Confirm open={!!confirmPlan} onClose={() => setConfirmPlan(null)} title={`Switch to ${confirmPlan?.name}?`}
        body={data?.billingMode === "development" ? `Development billing: switching to ${confirmPlan?.name} (${cycle}) records a local subscription and invoice. No card is charged.` : `Your workspace will move to ${confirmPlan?.name} (${cycle}).`}
        onConfirm={subscribe} />
      <Confirm open={confirmCancel} onClose={() => setConfirmCancel(false)} danger title="Cancel subscription?"
        body="Access continues until the end of the current period, then the workspace returns to Free. Your datasets stay exportable — nothing is deleted."
        onConfirm={async () => { await post("/api/work", { resource: "billing", action: "cancel", workspaceId: session.wsId, id: data.subscription.id }); toast("Cancellation scheduled at period end", "info"); load(); }} />
    </AppShell>
  );
}
