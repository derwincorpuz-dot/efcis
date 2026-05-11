import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardCheck, CheckCircle2, XCircle, Send, Eye } from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  validated: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

// ---------- Collector view ----------
function CollectorClosing() {
  const [date, setDate] = useState(todayISO());
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [p, h] = await Promise.all([
      api.get(`/closing-reports/preview?date=${date}`).then((r) => r.data),
      api.get("/closing-reports").then((r) => r.data),
    ]);
    setPreview(p);
    setHistory(h || []);
  };
  useEffect(() => { load(); }, [date]);

  const submit = async () => {
    if (!preview?.payment_ids?.length) { toast.error("No collections to submit for this date"); return; }
    setBusy(true);
    try {
      await api.post("/closing-reports", { date });
      toast.success("Closing report submitted");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44 mt-1" data-testid="closing-date" />
          </div>
          {preview && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
              <Stat label="Collected" value={`₱ ${fmt(preview.totals.collected_amount)}`} color="green" />
              <Stat label="Passed" value={`₱ ${fmt(preview.totals.passed_amount)}`} color="amber" />
              <Stat label="# Paid" value={preview.totals.count_paid} />
              <Stat label="# Passed" value={preview.totals.count_passed} />
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={busy} className="efcis-gradient text-white" data-testid="submit-closing">
            <Send className="w-4 h-4 mr-1.5" /> {busy ? "Submitting…" : "Submit Closing Report"}
          </Button>
        </div>
      </Card>

      <Card className="border-slate-200">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-800 font-heading text-sm">My Closing Reports</div>
        <ReportTable rows={history} />
      </Card>
    </div>
  );
}

// ---------- BA roll-up ----------
function BranchAssistantClosing() {
  const [date, setDate] = useState(todayISO());
  const [collectors, setCollectors] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [c, h] = await Promise.all([
      api.get(`/closing-reports?type=collector&status=pending&date=${date}`).then((r) => r.data),
      api.get(`/closing-reports?type=branch&date=${date}`).then((r) => r.data),
    ]);
    setCollectors(c || []);
    setPicked(new Set((c || []).map((x) => x.id)));
    setHistory(h || []);
  };
  useEffect(() => { load(); }, [date]);

  const toggle = (id) => {
    const ns = new Set(picked);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setPicked(ns);
  };

  const submit = async () => {
    if (picked.size === 0) { toast.error("Select at least one collector report"); return; }
    setBusy(true);
    try {
      await api.post("/closing-reports/branch-rollup", { date, collector_report_ids: Array.from(picked) });
      toast.success("Branch roll-up submitted to Area Manager");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const total = collectors.filter((c) => picked.has(c.id)).reduce((s, c) => s + (c.totals?.collected_amount || 0), 0);

  return (
    <div className="space-y-4">
      <Card className="p-5 border-slate-200">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44 mt-1" />
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-800 font-mono font-bold">
              Selected total: ₱ {fmt(total)}
            </div>
            <Button onClick={submit} disabled={busy || picked.size === 0} className="efcis-gradient text-white" data-testid="branch-rollup-submit">
              <Send className="w-4 h-4 mr-1.5" /> Submit to AM
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-slate-200">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-800 font-heading text-sm">Pending Collector Reports</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 text-left w-10"></th>
                <th className="px-4 py-3 text-left">Collector</th>
                <th className="px-4 py-3 text-right">Collected</th>
                <th className="px-4 py-3 text-right">Passed</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-left">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {collectors.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No pending collector closings for this date.</td></tr>
              ) : collectors.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5"><input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} data-testid={`pick-${r.id}`} /></td>
                  <td className="px-4 py-2.5 font-medium">{r.submitted_by_name}</td>
                  <td className="px-4 py-2.5 text-right font-mono">₱ {fmt(r.totals?.collected_amount)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-700">₱ {fmt(r.totals?.passed_amount)}</td>
                  <td className="px-4 py-2.5 text-right">{r.totals?.count_paid}</td>
                  <td className="px-4 py-2.5 text-right">{r.totals?.count_passed}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(r.submitted_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-slate-200">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-800 font-heading text-sm">Branch Roll-up History</div>
        <ReportTable rows={history} />
      </Card>
    </div>
  );
}

// ---------- AM validation ----------
function AreaManagerClosing() {
  const [rows, setRows] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await api.get(`/closing-reports?type=branch`);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []);

  const decide = async (r, decision) => {
    setBusy(true);
    try {
      await api.post(`/closing-reports/${r.id}/validate`, { decision });
      toast.success(`Marked ${decision}`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200">
        <div className="p-4 border-b border-slate-100 font-bold text-slate-800 font-heading text-sm">Branch Roll-ups</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="am-closing-table">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Submitted By</th>
                <th className="px-4 py-3 text-right">Collected</th>
                <th className="px-4 py-3 text-right">Passed</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No roll-ups yet.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">{r.date}</td>
                  <td className="px-4 py-2.5 font-medium">{r.submitted_by_name}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-green-700">₱ {fmt(r.totals?.collected_amount)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-700">₱ {fmt(r.totals?.passed_amount)}</td>
                  <td className="px-4 py-2.5 text-right">{r.totals?.count_paid}</td>
                  <td className="px-4 py-2.5 text-right">{r.totals?.count_passed}</td>
                  <td className="px-4 py-2.5"><span className={`status-pill border ${STATUS_STYLE[r.status] || ""}`}>{r.status}</span></td>
                  <td className="px-4 py-2.5">
                    {r.status === "submitted" ? (
                      <div className="flex gap-1.5">
                        <Button size="sm" disabled={busy} onClick={() => decide(r, "validated")} className="efcis-gradient text-white h-8" data-testid={`closing-validate-${r.id}`}><CheckCircle2 className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" disabled={busy} variant="outline" onClick={() => decide(r, "rejected")} className="text-red-600 h-8" data-testid={`closing-reject-${r.id}`}><XCircle className="w-3.5 h-3.5" /></Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setViewing(r)} className="h-8"><Eye className="w-3.5 h-3.5 mr-1" /> View</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {viewing && (
        <Dialog open onOpenChange={() => setViewing(null)}>
          <DialogContent className="w-[95vw] max-w-2xl sm:rounded-2xl">
            <DialogHeader><DialogTitle className="font-heading font-extrabold">Branch Roll-up Detail</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div><b>Date:</b> {viewing.date}</div>
              <div><b>Status:</b> {viewing.status}</div>
              <div><b>Submitted by:</b> {viewing.submitted_by_name}</div>
              <div><b>Validated by:</b> {viewing.validated_by_name || "—"}</div>
              <div><b>Notes:</b> {viewing.notes || "—"}</div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Stat label="Collected" value={`₱ ${fmt(viewing.totals?.collected_amount)}`} color="green" />
                <Stat label="Passed" value={`₱ ${fmt(viewing.totals?.passed_amount)}`} color="amber" />
                <Stat label="# Paid" value={viewing.totals?.count_paid} />
                <Stat label="# Passed" value={viewing.totals?.count_passed} />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  const map = { green: "bg-green-50 border-green-200 text-green-800", amber: "bg-amber-50 border-amber-200 text-amber-800" };
  return (
    <div className={`p-3 rounded-lg border ${map[color] || "bg-slate-50 border-slate-200 text-slate-800"}`}>
      <div className="text-[11px] uppercase font-bold tracking-wider opacity-80">{label}</div>
      <div className="text-lg font-bold font-mono mt-0.5">{value}</div>
    </div>
  );
}

function ReportTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
          <tr>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-right">Collected</th>
            <th className="px-4 py-3 text-right">Passed</th>
            <th className="px-4 py-3 text-left">Submitted</th>
            <th className="px-4 py-3 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No reports yet.</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2.5">{r.date}</td>
              <td className="px-4 py-2.5 text-right font-mono">₱ {fmt(r.totals?.collected_amount)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-amber-700">₱ {fmt(r.totals?.passed_amount)}</td>
              <td className="px-4 py-2.5 text-xs text-slate-500">{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</td>
              <td className="px-4 py-2.5"><span className={`status-pill border ${STATUS_STYLE[r.status] || ""}`}>{r.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ClosingReportTab() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "field_collector") return <CollectorClosing />;
  if (user.role === "branch_assistant") return <BranchAssistantClosing />;
  if (user.role === "area_manager" || user.role === "admin") return <AreaManagerClosing />;
  return (
    <Card className="p-10 text-center text-slate-500 border-slate-200">
      <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
      Closing reports are available to Field Collectors, Branch Assistants, Area Managers, and Admins.
    </Card>
  );
}
