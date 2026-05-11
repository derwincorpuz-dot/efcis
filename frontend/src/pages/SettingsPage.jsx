import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, ROLES } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Upload, Save, ShieldCheck, Users, FileText, Image as ImageIcon, Pencil, Trash2, Plus, Palette, Activity } from "lucide-react";
import FileAttach from "@/components/FileAttach";

const ROLE_OPTIONS = Object.keys(ROLES);

function UserModal({ open, onClose, editing, onSaved }) {
  const isEdit = !!editing;
  const [form, setForm] = useState({
    name: editing?.name || "",
    email: editing?.email || "",
    role: editing?.role || "field_collector",
    password: "",
    avatar_data_url: editing?.avatar_data_url || null,
  });
  const [saving, setSaving] = useState(false);

  const onAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setForm((p) => ({ ...p, avatar_data_url: r.result }));
    r.readAsDataURL(f);
  };

  const submit = async () => {
    if (!form.name || !form.email || !form.role || (!isEdit && !form.password)) {
      toast.error("Name, email, role, and password are required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const body = { ...form };
        if (!body.password) delete body.password;
        await api.put(`/users/${editing.id}`, body);
        toast.success("User updated");
      } else {
        await api.post("/users", form);
        toast.success("User created");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-extrabold">{isEdit ? "Edit User" : "Create User"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Avatar className="w-16 h-16 ring-2 ring-green-100">
              {form.avatar_data_url ? <AvatarImage src={form.avatar_data_url} /> : <AvatarFallback className="efcis-gradient text-white text-xl">{(form.name || "U").slice(0, 1).toUpperCase()}</AvatarFallback>}
            </Avatar>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={onAvatar} className="hidden" data-testid="user-avatar-upload" />
              <span className="inline-flex items-center gap-2 px-3 h-9 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                <Upload className="w-4 h-4" /> Avatar
              </span>
            </label>
          </div>
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name" />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email" />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger data-testid="user-role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{ROLES[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Password {isEdit && <span className="text-slate-400">(leave blank to keep current)</span>}</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="efcis-gradient text-white" data-testid="user-save">{saving ? "Saving…" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActivityLogTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.get("/activity-logs?limit=500")
      .then((r) => setItems(r.data || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((r) => {
    const t = `${r.actor_name} ${r.action} ${r.target_type} ${JSON.stringify(r.details || {})}`.toLowerCase();
    return t.includes(filter.toLowerCase());
  });

  return (
    <Card className="border-slate-200">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900 font-heading">System Activity Log</h3>
          <p className="text-sm text-slate-500">{items.length} recent events — used to trace actions and accountability</p>
        </div>
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className="max-w-xs" data-testid="activity-filter" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="activity-table">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Target</th>
              <th className="px-4 py-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No activity yet.</td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 text-xs font-mono text-slate-500">{r.at ? new Date(r.at).toLocaleString() : "—"}</td>
                <td className="px-4 py-2.5 font-medium">{r.actor_name}</td>
                <td className="px-4 py-2.5 text-xs">{ROLES[r.actor_role] || r.actor_role}</td>
                <td className="px-4 py-2.5"><span className="status-pill bg-blue-50 text-blue-700 border border-blue-200">{r.action}</span></td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{r.target_type || "—"}{r.target_id ? ` • ${r.target_id.slice(0, 8)}` : ""}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600 font-mono max-w-xs truncate">{r.details ? JSON.stringify(r.details) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [logo, setLogo] = useState(null);
  const [systemName, setSystemName] = useState("EFCIS LMS");
  const [loanForm, setLoanForm] = useState(null);
  const [comakerForm, setComakerForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [userModal, setUserModal] = useState({ open: false, editing: null });

  const loadSettings = async () => {
    const { data } = await api.get("/settings");
    setLogo(data?.logo_data_url || null);
    setSystemName(data?.system_name || "EFCIS LMS");
    setLoanForm(data?.loan_form_image || null);
    setComakerForm(data?.comaker_form_image || null);
  };
  const loadUsers = async () => {
    try { const { data } = await api.get("/users"); setUsers(data || []); } catch {}
  };

  useEffect(() => { loadSettings(); }, []);
  useEffect(() => { if (user?.role === "admin") loadUsers(); }, [user]);

  if (user?.role !== "admin") return <div className="text-slate-500">Access restricted to admin.</div>;

  const onLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setLogo(r.result);
    r.readAsDataURL(file);
  };

  const saveBranding = async () => {
    setSaving(true);
    try {
      await api.put("/settings", { logo_data_url: logo, system_name: systemName });
      toast.success("Branding saved");
    } catch { toast.error("Failed"); } finally { setSaving(false); }
  };

  const saveForms = async () => {
    setSaving(true);
    try {
      await api.put("/settings", { loan_form_image: loanForm, comaker_form_image: comakerForm });
      toast.success("Form documents saved");
    } catch { toast.error("Failed"); } finally { setSaving(false); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete ${u.name}?`)) return;
    try { await api.delete(`/users/${u.id}`); toast.success("Deleted"); loadUsers(); }
    catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <Tabs defaultValue="branding" className="w-full">
        <TabsList>
          <TabsTrigger value="branding" data-testid="tab-branding"><Palette className="w-4 h-4 mr-1.5" /> Branding</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users"><Users className="w-4 h-4 mr-1.5" /> User Management</TabsTrigger>
          <TabsTrigger value="forms" data-testid="tab-forms"><FileText className="w-4 h-4 mr-1.5" /> Form Documents</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity"><Activity className="w-4 h-4 mr-1.5" /> Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <Card className="p-6 border-slate-200 max-w-2xl">
            <h3 className="text-lg font-bold text-slate-900 font-heading">Branding</h3>
            <p className="text-sm text-slate-500 mt-1">Upload your system logo and customize display name.</p>
            <div className="mt-6 space-y-5">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Logo (2×2 inch)</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl efcis-gradient flex items-center justify-center overflow-hidden shadow-md shadow-green-500/25">
                    {logo ? <img src={logo} alt="Logo" className="w-full h-full object-cover" /> : <ShieldCheck className="w-10 h-10 text-white" />}
                  </div>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" data-testid="settings-logo-upload" />
                    <span className="inline-flex items-center gap-2 px-4 h-10 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Upload className="w-4 h-4" /> Upload Logo
                    </span>
                  </label>
                  {logo && <button onClick={() => setLogo(null)} className="text-xs text-red-600 hover:underline">Remove</button>}
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">System Name</Label>
                <Input value={systemName} onChange={(e) => setSystemName(e.target.value)} className="mt-2" data-testid="settings-system-name" />
              </div>
              <Button onClick={saveBranding} disabled={saving} className="efcis-gradient text-white" data-testid="settings-save"><Save className="w-4 h-4 mr-1.5" />{saving ? "Saving…" : "Save Branding"}</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card className="border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-heading">User Management</h3>
                <p className="text-sm text-slate-500">{users.length} users</p>
              </div>
              <Button onClick={() => setUserModal({ open: true, editing: null })} className="efcis-gradient text-white" data-testid="user-create"><Plus className="w-4 h-4 mr-1.5" /> Add User</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="users-table">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                  <tr>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          {u.avatar_data_url ? <AvatarImage src={u.avatar_data_url} /> : <AvatarFallback className="efcis-gradient text-white text-xs">{(u.name || "U").slice(0, 1).toUpperCase()}</AvatarFallback>}
                        </Avatar>
                        <span className="font-medium text-slate-800">{u.name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3"><span className="status-pill bg-green-50 text-green-700 border border-green-200">{ROLES[u.role] || u.role}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setUserModal({ open: true, editing: u })} data-testid={`user-edit-${u.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="outline" onClick={() => deleteUser(u)} className="text-red-600" data-testid={`user-delete-${u.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {userModal.open && <UserModal {...userModal} onClose={() => setUserModal({ open: false, editing: null })} onSaved={loadUsers} />}
        </TabsContent>

        <TabsContent value="forms" className="mt-4">
          <Card className="p-6 border-slate-200 max-w-3xl">
            <h3 className="text-lg font-bold text-slate-900 font-heading">Form Documents</h3>
            <p className="text-sm text-slate-500 mt-1">Upload templates. Users can download them from the Forms page as 8.5″×13″ PDFs.</p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileAttach label="Loan Application Form (image)" accept="image/*" value={loanForm} onChange={setLoanForm} testid="settings-loan-form" />
              <FileAttach label="Co-Maker Form (image)" accept="image/*" value={comakerForm} onChange={setComakerForm} testid="settings-comaker-form" />
            </div>
            <Button onClick={saveForms} disabled={saving} className="efcis-gradient text-white mt-5" data-testid="settings-forms-save"><Save className="w-4 h-4 mr-1.5" />{saving ? "Saving…" : "Save Forms"}</Button>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
