"use client";
import { computeWidget, inferColumns, type Row } from "@/lib/dataEngine";
import { Chart, DataTable } from "./charts";

export const THEMES: Record<string, { name: string; color: string; bg: string; card: string }> = {
  emerald: { name: "Emerald Executive", color: "#059669", bg: "#f2f8f5", card: "#ffffff" },
  minimal: { name: "Minimal White", color: "#334155", bg: "#ffffff", card: "#f8fafc" },
  midnight: { name: "Midnight Analytics", color: "#38bdf8", bg: "#0b1220", card: "#111c30" },
  ocean: { name: "Ocean Blue", color: "#0284c7", bg: "#f0f7fc", card: "#ffffff" },
  warm: { name: "Warm Neutral", color: "#b45309", bg: "#faf6f0", card: "#fffdf9" },
};

export function WidgetCard({ widget, rows, theme, onSelect, footer }: { widget: any; rows: Row[]; theme?: string; onSelect?: (label: string) => void; footer?: React.ReactNode }) {
  const meta = inferColumns(rows);
  const out = computeWidget(widget, rows, meta);
  const color = widget.color || THEMES[theme || "emerald"]?.color || "#059669";
  return (
    <div className="rounded-[14px] border p-3.5 h-full" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-1.5">
        <p className="font-bold text-[13px]">{widget.title}</p>
        <span className="badge b-slate ml-auto">{widget.type}{widget.agg ? ` · ${widget.agg}` : ""}</span>
      </div>
      {widget.note && <p className="muted text-[11.5px] mb-1">{widget.note}</p>}
      {widget.type === "text" ? <p className="text-[13px] muted whitespace-pre-wrap">{widget.text || "—"}</p>
        : widget.type === "kpi" ? (
          <div className="py-2"><p className="text-[26px] font-extrabold tracking-tight" style={{ color }}>{out.value ?? "—"}</p>
            <p className="muted text-[11.5px]">{widget.agg === "count" ? "rows in current filter" : `${widget.agg || "sum"} of ${widget.metric || ""}`}</p></div>
        ) : widget.type === "table" ? <DataTable data={out.data || []} valueLabel={widget.metric || "Value"} />
          : <Chart type={widget.type} data={out.data || []} color={color} onSelect={onSelect} />}
      {footer}
    </div>
  );
}

export function DashboardGrid({ widgets, rows, theme, onSelect }: { widgets: any[]; rows: Row[]; theme?: string; onSelect?: (dim: string, label: string) => void }) {
  if (!widgets?.length) return <div className="card p-8 text-center muted text-[13px]">This dashboard has no widgets yet. Add charts in the builder.</div>;
  return (
    <div className="grid grid-cols-12 gap-3">
      {widgets.map((w) => {
        const span = w.width >= 10 ? "col-span-12" : w.width >= 5 ? "col-span-12 md:col-span-6" : w.width >= 4 ? "col-span-12 sm:col-span-6 xl:col-span-4" : "col-span-6 xl:col-span-3";
        return (
          <div key={w.id} className={span}>
            <WidgetCard widget={w} rows={rows} theme={theme} onSelect={w.dimension && onSelect ? (label) => onSelect(w.dimension, label) : undefined} />
          </div>
        );
      })}
    </div>
  );
}
export function applyFilters(rows: Row[], filters: Record<string, string>): Row[] {
  return rows.filter((r) => Object.entries(filters).every(([k, v]) => !v || String(r[k] ?? "").trim() === v));
}
