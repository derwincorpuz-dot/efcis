import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, ROLES } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarClock, LogIn, LogOut, BadgeDollarSign, Download, Clock } from "lucide-react";
import { toast } from "sonner";

const todayISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MyTab() {
  const [today, setToday] = useState(null);
  const [hist, setHist] = useState([]);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    const [t, h] = await Promise.all([
      api.get("/attendance/today").then(r => r.data),
      api.get("/attendance/me").then(r => r.data),
    ]);
    setToday(t && t.id ? t : null);
    setHist(h || []);
  };
  useEffect(() => { load(); }, []);

  const checkIn = async () => {
    setBusy(true);
    try {
      const location = await new Promise((res) => navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(
            (pos) => res({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => res(null), { timeout: 5000 })
        : res(null));
      await api.post("/attendance/check-in", { location });
      toast.success("Checked in");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const checkOut = async () => {
    setBusy(true);
    try {
      const location = await new Promise((res) => navigator.geolocation
        ? navigator.geolocation.getCurrentPosition(
            (pos) => res({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => res(null), { timeout: 5000 })
        : res(null));
      await api.post("/attendance/check-out", { location });
      toast.success("Checked out");
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };

  const inAt = today?.check_in ? new Date(today.check_in) : null;
  const outAt = today?.check_out ? new Date(today.check_out) : null;
  const liveHours = inAt && !outAt ? (now - inAt) / 3600000 : (today?.hours || 0);

  return (
    <div className="space-y-4">
      <Card className="p-5 border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-bold">Today</div>
            <div className="text-2xl font-bold font-heading text-slate-900">{now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
            <div className="text-sm font-mono text-slate-600 mt-0.5">{now.toLocaleTimeString()}</div>
          </div>
          <div className="flex gap-2">
            {!inAt ? (
              <Button onClick={checkIn} disabled={busy} className="efcis-gradient text-white" data-testid="check-in-button">
                <LogIn className="w-4 h-4 mr-1.5" /> Check In
              </Button>
            ) : !outAt ? (
              <Button onClick={checkOut} disabled={busy} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" data-testid="check-out-button">
                <LogOut className="w-4 h-4 mr-1.5" /> Check Out
              </Button>
            ) : (
              <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-semibold">✓ Completed for today</div>
            )}
          </div>
        </div>
        {inAt && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Check-in</div>
              <div className="font-mono mt-0.5">{inAt.toLocaleTimeString()}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Check-out</div>
              <div className="font-mono mt-0.5">{outAt ? outAt.toLocaleTimeString() : "—"}</div>
            </div>
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="text-[11px] uppercase tracking-wider text-green-700 font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> Hours</div>
              <div className="font-mono font-bold text-green-800 mt-0.5">{liveHours.toFixed(2)} h</div>
            </div>
          </div>
        )}
      </Card>

      <Card className="border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 font-bold text-slate-800 font-heading text-sm">My Attendance History</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Check-in</th>
                <th className="px-4 py-3 text-left">Check-out</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {hist.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No history yet.</td></tr>
              ) : hist.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">{r.date}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{(r.hours || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5"><span className="status-pill bg-green-50 text-green-700 border border-green-200">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AdminTab() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState([]);

  const load = async () => {
    const { data } = await api.get(`/attendance?from_date=${from}&to_date=${to}`);
    setRows(data || []);
  };
  useEffect(() => { load(); }, [from, to]);

  const setStatus = async (r, status) => {
    try {
      await api.put(`/attendance/${r.id}`, { status });
      toast.success(`Marked ${status}`);
      load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-slate-200">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="att-from" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="att-to" />
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="att-table">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Check-in</th>
                <th className="px-4 py-3 text-left">Check-out</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Mark</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No records.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">{r.date}</td>
                  <td className="px-4 py-2.5 font-medium">{r.user_name}</td>
                  <td className="px-4 py-2.5 text-xs">{ROLES[r.user_role] || r.user_role}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{(r.hours || 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5"><span className={`status-pill border ${r.status === "absent" ? "bg-red-50 text-red-700 border-red-200" : r.status === "late" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200"}`}>{r.status}</span></td>
                  <td className="px-4 py-2.5">
                    <Select value={r.status} onValueChange={(v) => setStatus(r, v)}>
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PayrollTab() {
  const [from, setFrom] = useState(todayISO().slice(0, 7) + "-01");
  const [to, setTo] = useState(todayISO());
  const [rate, setRate] = useState(500);
  const [data, setData] = useState({ items: [] });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/attendance/payroll?from_date=${from}&to_date=${to}&daily_rate=${rate}`);
      setData(d || { items: [] });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [from, to, rate]);

  const total = (data.items || []).reduce((s, x) => s + (x.gross_pay || 0), 0);

  const exportCsv = () => {
    const headers = ["Name", "Role", "Days Present", "Days Late", "Days Absent", "Total Hours", "Daily Rate", "Gross Pay"];
    const lines = [headers.join(",")];
    (data.items || []).forEach((r) => {
      lines.push([r.user_name, ROLES[r.user_role] || r.user_role, r.days_present, r.days_late, r.days_absent, r.total_hours, r.daily_rate, r.gross_pay].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Payroll_${from}_to_${to}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-slate-200">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Period From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Daily Rate (₱)</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-32" />
          </div>
          <Button onClick={exportCsv} variant="outline" className="ml-auto"><Download className="w-4 h-4 mr-1.5" /> Export CSV</Button>
        </div>
      </Card>

      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="payroll-table">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-right">Present</th>
                <th className="px-4 py-3 text-right">Late</th>
                <th className="px-4 py-3 text-right">Absent</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Gross Pay</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : (data.items || []).length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No data.</td></tr>
              ) : (data.items || []).map((r) => (
                <tr key={r.user_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium">{r.user_name}</td>
                  <td className="px-4 py-2.5 text-xs">{ROLES[r.user_role] || r.user_role}</td>
                  <td className="px-4 py-2.5 text-right">{r.days_present}</td>
                  <td className="px-4 py-2.5 text-right">{r.days_late}</td>
                  <td className="px-4 py-2.5 text-right">{r.days_absent}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{r.total_hours.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-green-700">₱ {fmt(r.gross_pay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold">
              <tr>
                <td colSpan={6} className="px-4 py-3 text-right uppercase text-xs tracking-wider">Total Payout</td>
                <td className="px-4 py-3 text-right font-mono text-green-700 text-base">₱ {fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-5 border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg efcis-gradient flex items-center justify-center shadow-md shadow-green-500/25">
            <CalendarClock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 font-heading">Attendance</h3>
            <p className="text-xs text-slate-500">Daily check-ins, branch attendance, and payroll</p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="me" className="w-full">
        <TabsList>
          <TabsTrigger value="me" data-testid="tab-my-attendance"><Clock className="w-4 h-4 mr-1.5" /> My Attendance</TabsTrigger>
          {isAdmin && <TabsTrigger value="all" data-testid="tab-all-attendance"><CalendarClock className="w-4 h-4 mr-1.5" /> All Records</TabsTrigger>}
          {isAdmin && <TabsTrigger value="payroll" data-testid="tab-payroll"><BadgeDollarSign className="w-4 h-4 mr-1.5" /> Payroll</TabsTrigger>}
        </TabsList>
        <TabsContent value="me" className="mt-4"><MyTab /></TabsContent>
        {isAdmin && <TabsContent value="all" className="mt-4"><AdminTab /></TabsContent>}
        {isAdmin && <TabsContent value="payroll" className="mt-4"><PayrollTab /></TabsContent>}
      </Tabs>
    </div>
  );
}
