"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell, useSession } from "@/components/shell";
import { api, post, useToast, Spinner, ErrBox, Modal, Confirm, download, rowsToCsv } from "@/components/ui";
import { Download, Plus, Trash2, UserPlus } from "lucide-react";

export default function Team() {
  const session = useSession(); const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "editor" });
  const [showWs, setShowWs] = useState(false); const [wsName, setWsName] = useState("");
  const [renameVal, setRenameVal] = useState("");
  const [deleteWs, setDeleteWs] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<any>(null);

  const load = useCallback(async () => {
    if (!session.wsId) return;
    try { const d = await api(`/api/work?resource=team&workspaceId=${session.wsId}`); setData(d); setRenameVal(d.workspace?.name || ""); } catch (e: any) { setErr(e.message); }
  }, [session.wsId]);
  useEffect(() => { load(); }, [load]);

  const exportWorkspace = async () => {
    try {
      const ds = await api(`/api/datasets?workspaceId=${session.wsId}`);
      for (const d of ds.datasets) { const full = await api(`/api/datasets/${d.id}`); download(`${d.name}.csv`, rowsToCsv(full.rows, full.columns)); }
      toast(ds.datasets.length ? `Exported ${ds.datasets.length} dataset CSV file(s)` : "Nothing to export yet");
    } catch (e: any) { toast(e.message, "error"); }
  };

  if (session.loading || !session.user) return <div className="p-8"><Spinner /></div>;
  const myRole = data?.myRole || session.ws?.myRole;
  const canAdmin = ["owner", "admin"].includes(myRole || "");
  return (
    <AppShell session={session} title="Team & Workspace Settings" subtitle="Roles: owner (everything incl. billing & deletion), admin (manage members/integrations), editor (create & edit data), viewer (read-only). Enforced server-side."
      actions={<>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowWs(true)}><Plus size={13} /> New workspace</button>
        <button className="btn btn-primary btn-sm" disabled={!canAdmin} onClick={() => setShowInvite(true)}><UserPlus size={13} /> Invite member</button>
      </>}>
      {err && <ErrBox msg={err} />}
      {!data ? <Spinner /> : (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="font-bold text-[14px] mb-3">Workspace</p>
            <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2.5 items-end">
              <div><label className="lbl">Name</label><input className="input" value={renameVal} disabled={!canAdmin} onChange={(e) => setRenameVal(e.target.value)} /></div>
              <button className="btn btn-primary" disabled={!canAdmin} onClick={async () => { await post("/api/work", { resource: "team", action: "rename", workspaceId: session.wsId, name: renameVal }); toast("Renamed — refresh to see it in the switcher"); }}>Save</button>
              <button className="btn btn-ghost" onClick={exportWorkspace}><Download size={13} /> Export all datasets</button>
            </div>
            <p className="muted text-[12px] mt-2">Plan: {data.workspace.planId} · Your role: {myRole} · Created {new Date(data.workspace.createdAt).toLocaleDateString()}</p>
            {myRole === "owner" && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 flex items-center gap-3">
              <p className="text-[12.5px] text-red-800 dark:text-red-200 flex-1"><b>Danger zone:</b> deleting this workspace removes all its datasets, dashboards and reports. Export first.</p>
              <button className="btn btn-danger btn-sm" onClick={() => setDeleteWs(true)}>Delete workspace</button></div>}
          </div>
          <div className="card overflow-hidden">
            <p className="font-bold text-[14px] px-4 pt-3.5">Members ({data.members.length})</p>
            <div className="overflow-x-auto"><table className="data"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th><th className="!text-right">Actions</th></tr></thead>
              <tbody>{data.members.map((m: any) => (
                <tr key={m.id}>
                  <td>{m.user ? <><b>{m.user.name}</b><br /><span className="muted">{m.user.email}</span></> : <span className="muted">{m.invitedEmail} (not registered yet)</span>}</td>
                  <td>{canAdmin && m.role !== "owner" ? <select className="select !w-[120px] !py-1" value={m.role} onChange={async (e) => { await post("/api/work", { resource: "team", action: "role", workspaceId: session.wsId, id: m.id, role: e.target.value }); toast("Role updated"); load(); }}>{["admin", "editor", "viewer"].map((r) => <option key={r}>{r}</option>)}</select> : <span className="badge b-slate capitalize">{m.role}</span>}</td>
                  <td><span className={`badge ${m.status === "active" ? "b-emerald" : "b-amber"}`}>{m.status}</span></td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td className="!text-right">{canAdmin && m.role !== "owner" && <button className="btn btn-ghost btn-sm !text-red-600" onClick={() => setRemoveTarget(m)}><Trash2 size={13} /></button>}</td>
                </tr>))}
              </tbody></table></div>
          </div>
          <p className="muted text-[12px]">Ownership transfer is intentionally not one-click in this build (safeguard): contact support from the owner account to transfer, so it can be verified and audited.</p>
        </div>
      )}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite team member">
        <div className="space-y-3">
          <div><label className="lbl">Email</label><input className="input" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></div>
          <div><label className="lbl">Role</label><select className="select" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>{["admin", "editor", "viewer"].map((r) => <option key={r}>{r}</option>)}</select></div>
          <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={async () => { try { const r = await post("/api/work", { resource: "team", action: "invite", workspaceId: session.wsId, ...invite }); toast(r.note); setShowInvite(false); load(); } catch (e: any) { toast(e.message, "error"); } }}>Invite</button></div>
        </div>
      </Modal>
      <Modal open={showWs} onClose={() => setShowWs(false)} title="Create workspace">
        <div><label className="lbl">Name</label><input className="input" value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="e.g. Marketing Analytics" /></div>
        <div className="flex justify-end gap-2 mt-4"><button className="btn btn-ghost" onClick={() => setShowWs(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={async () => { const r = await post("/api/work", { resource: "workspace", action: "create", name: wsName }); toast("Workspace created"); session.switchWs(r.workspace.id); setShowWs(false); window.location.reload(); }}>Create</button></div>
      </Modal>
      <Confirm open={deleteWs} onClose={() => setDeleteWs(false)} danger title="Delete this workspace?" body="All datasets, dashboards, reports and automations in this workspace will be permanently deleted. This cannot be undone."
        onConfirm={async () => { await post("/api/work", { resource: "team", action: "deleteWorkspace", workspaceId: session.wsId }); toast("Workspace deleted", "info"); window.location.href = "/app"; }} />
      <Confirm open={!!removeTarget} onClose={() => setRemoveTarget(null)} danger title="Remove member?" body="They immediately lose access to this workspace. Their account and other workspaces are unaffected."
        onConfirm={async () => { await post("/api/work", { resource: "team", action: "remove", workspaceId: session.wsId, id: removeTarget.id }); load(); }} />
    </AppShell>
  );
}
