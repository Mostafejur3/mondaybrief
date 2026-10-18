"use client";
import { createContext, useContext, useState, useCallback, type ReactNode, useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";

/* ---------- API helper ---------- */
export async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", ...(opts.headers || {}) } });
  let data: any = {};
  try { data = await res.json(); } catch {}
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
export const post = (path: string, body: any) => api(path, { method: "POST", body: JSON.stringify(body) });

/* ---------- Toasts ---------- */
const ToastCtx = createContext<(msg: string, kind?: "success" | "error" | "info") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const push = useCallback((msg: string, kind: "success" | "error" | "info" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] space-y-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="card flex items-start gap-2 px-3.5 py-2.5 text-[13px] font-medium shadow-lg max-w-sm fade-up">
            {t.kind === "error" ? <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" /> : t.kind === "info" ? <Info size={16} className="text-sky-600 shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal / Confirm ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`glass relative w-full ${wide ? "max-w-4xl" : "max-w-lg"} rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-bold text-[15px]">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-black/5" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
export function Confirm({ open, onClose, onConfirm, title, body, danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-[13.5px] muted mb-5">{body}</p>
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={() => { onConfirm(); onClose(); }}>Confirm</button>
      </div>
    </Modal>
  );
}

/* ---------- Small pieces ---------- */
export const Spinner = ({ label = "Loading…" }: { label?: string }) => (
  <div className="py-10 text-center"><div className="skel h-4 w-48 mx-auto mb-3" /><div className="skel h-32 max-w-xl mx-auto" /><p className="muted text-[13px] mt-3">{label}</p></div>
);
export const Empty = ({ title, body, action }: { title: string; body: string; action?: ReactNode }) => (
  <div className="card p-8 text-center">
    <p className="font-bold mb-1">{title}</p><p className="muted text-[13px] mb-4 max-w-md mx-auto">{body}</p>{action}
  </div>
);
export const ErrBox = ({ msg }: { msg: string }) => (
  <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-[13px] px-4 py-3 flex gap-2"><AlertTriangle size={16} className="shrink-0 mt-0.5" />{msg}</div>
);
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1"><span className="font-semibold">{label}</span><span className="muted">{value.toLocaleString()} / {max.toLocaleString()}</span></div>
      <div className="h-2 rounded-full" style={{ background: "var(--surface2)" }}><div className="h-2 rounded-full" style={{ width: `${pct}%`, background: pct > 85 ? "#dc2626" : pct > 60 ? "#d97706" : "var(--brand)" }} /></div>
    </div>
  );
}
export const sevBadge = (s: string) => s === "high" ? "b-red" : s === "medium" ? "b-amber" : "b-slate";
export const money = (cents: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
export const fmtDateTime = (d: any) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtDateOnly = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => { const t = localStorage.getItem("mb_theme"); if (t === "dark") { document.documentElement.classList.add("dark"); setDark(true); } }, []);
  const toggle = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("mb_theme", next ? "dark" : "light"); };
  return { dark, toggle };
}
export function download(filename: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
export function rowsToCsv(rows: Record<string, string>[], columns: string[]): string {
  const esc = (v: any) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [columns.map(esc).join(","), ...rows.map((r) => columns.map((c) => esc(r[c])).join(","))].join("\n");
}
