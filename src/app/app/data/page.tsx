"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, ErrBox, Modal, Confirm, fmtDateTime, Empty } from "@/components/ui";
import { parseFile, listSheets } from "@/lib/parseFile";
import { inferColumns } from "@/lib/dataEngine";
import { Archive, Copy, Database, Download, Eye, FileUp, Pencil, Search, Trash2, UploadCloud } from "lucide-react";
import * as XLSX from "xlsx";

export default function DataHub() {
  const session = useSession(); const toast = useToast();
  const [datasets, setDatasets] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""); const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("updatedAt");
  const [drag, setDrag] = useState(false);
  const [parsed, setParsed] = useState<any>(null); const [fileObj, setFileObj] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]); const [sheet, setSheet] = useState("");
  const [name, setName] = useState(""); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0);
  const [renameTarget, setRenameTarget] = useState<any>(null); const [renameVal, setRenameVal] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!session.wsId) return;
    try { const d = await api(`/api/datasets?workspaceId=${session.wsId}`); setDatasets(d.datasets); setFiles(d.files); }
    catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [session.wsId]);
  useEffect(() => { load(); }, [load]);

  const onFile = async (f: File) => {
    setErr("");
    try {
      setFileObj(f); const sh = await listSheets(f); setSheets(sh); setSheet(sh[0] || "");
      const p = await parseFile(f, sh[0]);
      setParsed(p); setName(f.name.replace(/\.[^.]+$/, ""));
      if (!p.rows.length) toast("No data rows detected — check the sheet/header row.", "error");
    } catch (e: any) { toast(e.message, "error"); }
  };
  const reparseSheet = async (s: string) => { setSheet(s); if (fileObj) { try { setParsed(await parseFile(fileObj, s)); } catch (e: any) { toast(e.message, "error"); } } };
  const doImport = async () => {
    if (!parsed || !fileObj) return;
    setBusy(true); setProgress(30);
    try {
      const d = await post("/api/datasets", { workspaceId: session.wsId, name, fileName: fileObj.name, fileType: parsed.format, sizeBytes: fileObj.size, sheetName: sheet, rows: parsed.rows });
      setProgress(100); toast(`Imported “${d.dataset.name}” — quality ${d.dataset.qualityScore}/100`);
      setParsed(null); setFileObj(null); await load();
    } catch (e: any) { toast(e.message, "error"); } finally { setBusy(false); setProgress(0); }
  };
  const act = async (ds: any, action: string, extra: any = {}) => {
    try { await post(`/api/datasets/${ds.id}`, { action, ...extra }); toast("Done"); await load(); }
    catch (e: any) { toast(e.message, "error"); }
  };
  const exportDs = async (ds: any, fmt: string) => {
    try {
      const d = await api(`/api/datasets/${ds.id}`);
      if (fmt === "xlsx") { const ws = XLSX.utils.json_to_sheet(d.rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data"); XLSX.writeFile(wb, `${ds.name}.xlsx`); }
      else { const { download, rowsToCsv } = await import("@/components/ui"); download(`${ds.name}.csv`, rowsToCsv(d.rows, d.columns)); }
    } catch (e: any) { toast(e.message, "error"); }
  };

  const filtered = datasets.filter((d) => (statusFilter === "all" || d.status === statusFilter) && d.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortKey === "name" ? a.name.localeCompare(b.name) : sortKey === "quality" ? b.qualityScore - a.qualityScore : +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const meta = parsed?.rows?.length ? inferColumns(parsed.rows) : [];

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  return (
    <AppShell session={session} title="Data Hub" subtitle="Import CSV, TSV, JSON or XLSX. Files are previewed and type-checked before saving; plan limits are enforced on the server — oversized files are rejected, never truncated."
      actions={<button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}><UploadCloud size={14} /> Upload file</button>}>
      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.json,.xlsx,.xls" className="hidden" multiple onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); if (e.target.files && e.target.files.length > 1) toast("Multiple files selected — importing one at a time so each gets its own preview & quality check.", "info"); }} />
      {err && <ErrBox msg={err} />}
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
        className={`card p-5 mb-4 text-center border-dashed ${drag ? "ring-2 ring-emerald-500" : ""}`} style={{ borderStyle: "dashed" }}>
        <FileUp size={22} className="mx-auto text-emerald-600 mb-1.5" />
        <p className="font-bold text-[14px]">Drag & drop a dataset here, or <button className="link" onClick={() => fileRef.current?.click()}>browse files</button></p>
        <p className="muted text-[12px] mt-1">CSV · TSV · TXT · JSON · XLSX · XLS — executables and documents (PDF/DOCX) are rejected as non-tabular.</p>
        {progress > 0 && <div className="max-w-sm mx-auto mt-3 h-2 rounded-full" style={{ background: "var(--surface2)" }}><div className="h-2 rounded-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} /></div>}
      </div>

      {parsed && (
        <div className="card p-4 mb-4">
          <p className="font-bold text-[14.5px]">Import preview — {fileObj?.name}</p>
          <p className="muted text-[12px] mt-0.5">{parsed.rows.length.toLocaleString()} data rows · {parsed.columns.length} columns · {(fileObj!.size / 1024).toFixed(1)} KB · format: {parsed.format.toUpperCase()}. Nothing is saved until you confirm.</p>
          <div className="grid sm:grid-cols-3 gap-3 mt-3">
            <div><label className="lbl">Dataset name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            {sheets.length > 1 && <div><label className="lbl">Sheet</label><select className="select" value={sheet} onChange={(e) => reparseSheet(e.target.value)}>{sheets.map((s) => <option key={s}>{s}</option>)}</select></div>}
            <div><label className="lbl">Detected column types</label><div className="flex flex-wrap gap-1">{meta.slice(0, 8).map((m) => <span key={m.name} className="badge b-slate">{m.name}: {m.type}</span>)}{meta.length > 8 && <span className="badge b-slate">+{meta.length - 8} more</span>}</div></div>
          </div>
          <div className="overflow-auto max-h-[220px] mt-3 rounded-lg border" style={{ borderColor: "var(--border)" }}>
            <table className="data"><thead><tr>{parsed.columns.map((c: string) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>{parsed.rows.slice(0, 8).map((r: any, i: number) => <tr key={i}>{parsed.columns.map((c: string) => <td key={c}>{String(r[c] ?? "")}</td>)}</tr>)}</tbody></table>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn btn-primary" disabled={busy || !parsed.rows.length} onClick={doImport}>{busy ? "Importing…" : `Import ${parsed.rows.length.toLocaleString()} rows`}</button>
            <button className="btn btn-ghost" onClick={() => { setParsed(null); setFileObj(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="relative"><Search size={14} className="absolute left-2.5 top-[9px] muted" /><input className="input pl-8 w-[210px]" placeholder="Search datasets…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="select !w-[140px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="archived">Archived</option></select>
        <select className="select !w-[160px]" value={sortKey} onChange={(e) => setSortKey(e.target.value)}><option value="updatedAt">Recently updated</option><option value="name">Name A–Z</option><option value="quality">Quality score</option></select>
        <span className="muted text-[12px] ml-auto">{filtered.length} dataset(s) · {files.length} import record(s)</span>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <Empty title="No datasets yet" body="Upload your first CSV or spreadsheet above. You'll get an instant quality score, an issue list tied to exact cells, and a cleaning studio that previews every fix before applying it." action={<button className="btn btn-primary" onClick={() => fileRef.current?.click()}>Upload a file</button>} />
      ) : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="data">
          <thead><tr><th>Dataset</th><th>Rows × Cols</th><th>Quality</th><th>Source</th><th>Status</th><th>Updated</th><th className="!text-right">Actions</th></tr></thead>
          <tbody>{filtered.map((d) => (
            <tr key={d.id}>
              <td><Link href={`/app/datasets/${d.id}`} className="font-bold hover:underline flex items-center gap-1.5"><Database size={14} className="text-emerald-600 shrink-0" />{d.name}</Link>{d.isDemo && <span className="badge b-amber ml-1">sample</span>}</td>
              <td>{d.rowCount.toLocaleString()} × {(d.columns || []).length}</td>
              <td><span className={`badge ${d.qualityScore >= 90 ? "b-emerald" : d.qualityScore >= 70 ? "b-amber" : "b-red"}`}>{d.qualityScore}/100</span></td>
              <td className="capitalize">{d.source}</td><td><span className={`badge ${d.status === "active" ? "b-emerald" : "b-slate"}`}>{d.status}</span></td>
              <td>{fmtDateTime(d.updatedAt)}</td>
              <td className="!text-right whitespace-nowrap">
                <Link href={`/app/datasets/${d.id}`} className="btn btn-ghost btn-sm" title="Open in Cleaning Studio"><Eye size={13} /></Link>{" "}
                <button className="btn btn-ghost btn-sm" title="Rename" onClick={() => { setRenameTarget(d); setRenameVal(d.name); }}><Pencil size={13} /></button>{" "}
                <button className="btn btn-ghost btn-sm" title="Duplicate" onClick={() => act(d, "duplicate")}><Copy size={13} /></button>{" "}
                <button className="btn btn-ghost btn-sm" title="Export CSV" onClick={() => exportDs(d, "csv")}><Download size={13} /></button>{" "}
                <button className="btn btn-ghost btn-sm" title={d.status === "active" ? "Archive" : "Activate"} onClick={() => act(d, d.status === "active" ? "archive" : "activate")}><Archive size={13} /></button>{" "}
                <button className="btn btn-ghost btn-sm !text-red-600" title="Delete" onClick={() => setDeleteTarget(d)}><Trash2 size={13} /></button>
              </td></tr>
          ))}</tbody></table></div></div>
      )}

      {files.length > 0 && (
        <div className="card overflow-hidden mt-4"><p className="font-bold text-[13.5px] px-4 pt-3">Import history</p>
          <div className="overflow-x-auto"><table className="data"><thead><tr><th>File</th><th>Type</th><th>Size</th><th>Status</th><th>Uploaded</th></tr></thead>
            <tbody>{files.slice(0, 10).map((f) => <tr key={f.id}><td className="font-semibold">{f.name}</td><td className="uppercase">{f.type}</td><td>{(f.sizeBytes / 1024).toFixed(1)} KB</td><td><span className="badge b-emerald">{f.status}</span></td><td>{fmtDateTime(f.createdAt)}</td></tr>)}</tbody></table></div></div>
      )}

      <Modal open={!!renameTarget} onClose={() => setRenameTarget(null)} title="Rename dataset">
        <input className="input" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} />
        <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost" onClick={() => setRenameTarget(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { act(renameTarget, "rename", { name: renameVal }); setRenameTarget(null); }}>Save</button></div>
      </Modal>
      <Confirm open={!!deleteTarget} onClose={() => setDeleteTarget(null)} danger title="Delete dataset permanently?"
        body={`“${deleteTarget?.name}” and all its rows, cleaning history and snapshots will be permanently deleted. Export first if you need a copy.`}
        onConfirm={() => act(deleteTarget, "delete")} />
    </AppShell>
  );
}
