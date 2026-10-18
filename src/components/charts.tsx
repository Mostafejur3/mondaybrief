"use client";
export interface Pt { label: string; value: number }
export const PALETTE = ["#059669", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#64748b", "#84cc16", "#ec4899"];
const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n * 100) / 100);

export function Chart({ type, data, color = "#059669", onSelect, height = 200 }: { type: string; data: Pt[]; color?: string; onSelect?: (label: string) => void; height?: number }) {
  if (!data?.length) return <div className="muted text-[12.5px] py-8 text-center">No data to chart with the current filters.</div>;
  const W = 560, H = height, padL = 42, padB = 30, padT = 10, padR = 8;
  const max = Math.max(...data.map((d) => d.value), 0), min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const x = (i: number) => padL + (i / Math.max(1, data.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / range) * (H - padT - padB);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => { const v = min + f * range; return (<g key={f}><line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.08} /><text x={padL - 5} y={y(v) + 3} fontSize="9" textAnchor="end" fill="currentColor" opacity={0.55}>{fmt(v)}</text></g>); });
  const xLabels = data.map((d, i) => data.length <= 8 || i % Math.ceil(data.length / 8) === 0 ? (
    <text key={i} x={type === "bar" || type === "histogram" ? padL + ((i + 0.5) / data.length) * (W - padL - padR) : x(i)} y={H - 8} fontSize="9" textAnchor="middle" fill="currentColor" opacity={0.6}>{d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label}</text>) : null);

  if (type === "bar" || type === "histogram" || type === "funnel") {
    const bw = (W - padL - padR) / data.length;
    return (<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bar chart">{grid}
      {data.map((d, i) => (<g key={i} onClick={() => onSelect?.(d.label)} style={{ cursor: onSelect ? "pointer" : "default" }}>
        <rect x={padL + i * bw + bw * 0.16} y={y(Math.max(d.value, min))} width={bw * 0.68} height={Math.max(1, (H - padT - padB) - (y(d.value) - padT))} rx={4} fill={type === "funnel" ? PALETTE[i % PALETTE.length] : color} opacity={0.92}>
          <title>{d.label}: {fmt(d.value)}</title></rect></g>))}
      {xLabels}</svg>);
  }
  if (type === "donut" || type === "pie") {
    const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
    let ang = -Math.PI / 2; const cx = 130, cy = H / 2, r = Math.min(H / 2 - 12, 92), r2 = type === "donut" ? r * 0.58 : 0;
    const arcs = data.slice(0, 8).map((d, i) => { const frac = Math.max(0, d.value) / total; const a1 = ang, a2 = ang + frac * Math.PI * 2; ang = a2; const large = a2 - a1 > Math.PI ? 1 : 0;
      const p = (rr: number, a: number) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
      const path = type === "donut" ? `M ${p(r, a1)} A ${r} ${r} 0 ${large} 1 ${p(r, a2)} L ${p(r2, a2)} A ${r2} ${r2} 0 ${large} 0 ${p(r2, a1)} Z` : `M ${cx},${cy} L ${p(r, a1)} A ${r} ${r} 0 ${large} 1 ${p(r, a2)} Z`;
      return <path key={i} d={path} fill={PALETTE[i % PALETTE.length]} stroke="var(--surface)" strokeWidth={1.5}><title>{d.label}: {fmt(d.value)} ({(frac * 100).toFixed(1)}%)</title></path>; });
    return (<div className="flex items-center gap-2 flex-wrap"><svg viewBox={`0 0 270 ${H}`} className="w-[46%] min-w-[170px]" role="img" aria-label="Donut chart">{arcs}
      {type === "donut" && <text x={cx} y={cy + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">{fmt(total)}</text>}</svg>
      <ul className="text-[12px] space-y-1 flex-1 min-w-[130px]">{data.slice(0, 8).map((d, i) => (<li key={i} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate">{d.label}</span><b className="ml-auto">{fmt(d.value)}</b></li>))}</ul></div>);
  }
  if (type === "scatter") {
    const xs = data.map((d) => Number(d.label) || 0); const xMax = Math.max(...xs, 1), xMin = Math.min(...xs, 0);
    const sx = (v: number) => padL + ((v - xMin) / (xMax - xMin || 1)) * (W - padL - padR);
    return (<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Scatter plot">{grid}
      {data.map((d, i) => <circle key={i} cx={sx(Number(d.label) || 0)} cy={y(d.value)} r={3.2} fill={color} opacity={0.65}><title>({d.label}, {fmt(d.value)})</title></circle>)}</svg>);
  }
  // line / area
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  return (<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart">{grid}
    {type === "area" && <polygon points={`${padL},${H - padB} ${pts} ${x(data.length - 1)},${H - padB}`} fill={color} opacity={0.16} />}
    <polyline points={pts} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
    {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r={3} fill={color}><title>{d.label}: {fmt(d.value)}</title></circle>)}
    {xLabels}</svg>);
}

export function DataTable({ data, valueLabel = "Value" }: { data: Pt[]; valueLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (<div className="overflow-auto max-h-[260px]"><table className="data"><thead><tr><th>Group</th><th>{valueLabel}</th><th>Share</th></tr></thead>
    <tbody>{data.map((d, i) => (<tr key={i}><td>{d.label}</td><td><b>{d.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b></td><td>{total ? ((d.value / total) * 100).toFixed(1) : "0"}%</td></tr>))}
    <tr><td><b>Total</b></td><td><b>{total.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b></td><td>100%</td></tr></tbody></table></div>);
}
