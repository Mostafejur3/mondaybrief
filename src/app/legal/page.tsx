"use client";
import { useEffect, useState } from "react";
import { PublicShell, PageHead } from "@/components/shell";

const sections: Record<string, { t: string; body: string[] }> = {
  terms: { t: "Terms of Service", body: [
    "1. The service. MondayBrief AI provides data import, cleaning, analytics, dashboards, reports and related tools on an “as available” basis. Features labelled as development-mode (notably billing) do not perform real financial transactions.",
    "2. Your data. You retain all rights to data you upload. We process it solely to provide the service within your workspace. You are responsible for having the legal right to upload and analyze the data you provide, including personal data.",
    "3. Acceptable use. Do not upload unlawful content, attempt to access other workspaces, probe for vulnerabilities without written authorization, or use the service to send unsolicited communications.",
    "4. Analytical outputs. Calculations are deterministic and reproducible, but business decisions remain yours. AI-suggested actions are recommendations, clearly distinguished from computed facts.",
    "5. Subscriptions. Paid plans renew per the selected cycle until cancelled. Cancellation takes effect at the end of the current period; data export remains available. Prices may change with notice before the next renewal.",
    "6. Availability & backups. We take reasonable measures to keep the service available and data backed up, but you should keep independent copies of critical source files.",
    "7. Liability. To the extent permitted by law, liability is limited to fees paid in the preceding 12 months. Nothing in these terms limits liability that cannot be limited by law.",
    "8. Changes. Material changes to these terms will be announced in-app before taking effect.",
  ]},
  privacy: { t: "Privacy Policy", body: [
    "What we store: account details (name, email, hashed password), workspace metadata, datasets you upload (stored as structured rows), dashboards/reports you create, support conversations, usage counters and audit logs needed for security and billing.",
    "What we don't do: we do not sell personal data, we do not train models on your datasets, and in the default configuration your rows are never sent to external AI providers — analytics run on our servers deterministically.",
    "Access control: datasets are scoped to workspaces and enforced server-side. Administrative access is role-based and audited.",
    "Retention & deletion: you can delete datasets, reports and your entire account (including owned workspaces) at any time. Backups containing deleted data age out per the operator's backup rotation.",
    "Subprocessors: infrastructure providers (hosting, database) and, when configured by the operator, payment and email providers process limited data to deliver the service.",
    "Your rights: depending on your jurisdiction you may request access, correction, export or erasure of personal data. Use the Support Center; exports of datasets are self-serve (CSV/XLSX).",
    "Security measures are described on the Security page. Formal certifications (e.g. SOC 2) are not claimed.",
  ]},
  cookies: { t: "Cookie Preferences", body: [
    "MondayBrief AI uses one essential cookie (mb_session) to keep you signed in. It is httpOnly and cannot be read by page scripts.",
    "Your theme preference and last-used workspace are stored in browser localStorage (mb_theme, mb_ws) — purely functional, never used for advertising or cross-site tracking.",
    "No third-party analytics or advertising cookies are set by default. If an operator adds analytics, they must update this page and obtain consent where required.",
  ]},
};
export default function Legal() {
  const [active, setActive] = useState("terms");
  useEffect(() => { const h = window.location.hash.replace("#", ""); if (sections[h]) setActive(h); }, []);
  return (
    <PublicShell>
      <PageHead title="Legal" sub="Plain-language terms. These are starter documents for the product — have counsel review them before commercial launch in your jurisdiction." />
      <div className="max-w-5xl mx-auto px-4 pb-10">
        <div className="flex gap-2 mb-4 flex-wrap">{Object.entries(sections).map(([id, s]) => <button key={id} onClick={() => setActive(id)} className={`btn btn-sm ${active === id ? "btn-primary" : "btn-ghost"}`}>{s.t}</button>)}</div>
        <article className="card p-6"><h2 className="text-[19px] font-extrabold mb-3">{sections[active].t}</h2>
          {sections[active].body.map((p, i) => <p key={i} className="text-[13.5px] leading-relaxed mb-3">{p}</p>)}
          <p className="muted text-[12px]">Last updated: January 2026 (template).</p></article>
      </div>
    </PublicShell>
  );
}
