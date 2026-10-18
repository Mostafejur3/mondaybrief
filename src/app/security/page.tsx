"use client";
import { PublicShell, PageHead } from "@/components/shell";
import { ShieldCheck } from "lucide-react";
const items = [
  ["Authentication", "Passwords are hashed with scrypt (per-user salt). Sessions use random tokens stored only as SHA-256 hashes, in httpOnly cookies with 7-day expiry and server-side revocation. Login/registration endpoints are rate-limited."],
  ["Authorization & isolation", "Every API route verifies the session and workspace membership server-side. Viewers are read-only; integration and billing changes require owner/admin. Admin routes additionally require an admin role — checked on the server, never just hidden in the UI."],
  ["File safety", "Uploads are parsed in the browser (SheetJS/PapaParse) and re-validated on the server: row limits per plan, cell-size caps, unsupported formats rejected. CSV exports neutralize spreadsheet formula injection (=, +, −, @ prefixes)."],
  ["Secrets", "Integration passwords are encrypted with AES-256-GCM and never returned to clients. The application database credential lives only in server environment variables and is not editable from any admin form."],
  ["AI safety", "Answers come from a deterministic calculation layer. Uploaded cell content is data, never instructions. No raw rows are sent to external AI providers in the default configuration."],
  ["Auditability", "Logins, cleaning operations, billing changes, admin actions and integration tests are written to an audit log. Cleaning operations keep revertible snapshots."],
  ["Payments", "No card details are collected or stored. Until Stripe is fully configured, billing runs in a clearly labelled development mode with zero real charges."],
  ["Your control", "Delete datasets, revoke sessions, export everything (CSV/XLSX) and delete your account (with owned workspaces) at any time from Profile & Security."],
  ["Honest compliance note", "These controls are implemented and testable, but they do not by themselves constitute GDPR, SOC 2 or ISO 27001 certification. Formal compliance requires organizational processes, DPAs and independent audits beyond this codebase."],
];
export default function Security() {
  return (
    <PublicShell>
      <PageHead title="Security & privacy" sub="Security is part of the architecture — here is precisely what is implemented, and what we do not claim." />
      <div className="max-w-5xl mx-auto px-4 pb-10 grid sm:grid-cols-2 gap-3.5">
        {items.map(([t, b]) => (
          <div key={t} className="card p-4.5 p-4"><p className="font-bold text-[14.5px] flex items-center gap-2 mb-1.5"><ShieldCheck size={16} className="text-emerald-600" />{t}</p><p className="muted text-[13px] leading-relaxed">{b}</p></div>
        ))}
      </div>
    </PublicShell>
  );
}
