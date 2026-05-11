import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wallet, Calendar, Search, CheckCircle2, AlertTriangle, Receipt, History, ClipboardCheck } from "lucide-react";
import { CollectModal, PassModal } from "@/components/PaymentModals";
import PaymentHistoryTab from "@/components/PaymentHistoryTab";
import ClosingReportTab from "@/components/ClosingReportTab";

const fmt = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function PaymentsPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [collectRow, setCollectRow] = useState(null);
  const [passRow, setPassRow] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/payments/daily?date=${date}&include_outstanding=true`);
      setRows(data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [date]);

  const filtered = rows.filter((r) => {
    const t = `${r.control_no} ${r.borrower_name} ${r.contact_no} ${r.address}`.toLowerCase();
    return t.includes(q.toLowerCase());
  });

  const totals = filtered.reduce((acc, r) => {
    if (r.status === "paid") acc.collected += r.amount;
    else if (r.status === "outstanding") acc.outstanding += r.amount;
    else acc.pending += r.amount;
    return acc;
  }, { collected: 0, outstanding: 0, pending: 0 });

  const StatusBadge = ({ status }) => {
    const map = {
      paid: { cls: "bg-green-50 text-green-700 border-green-200", label: "Paid" },
      outstanding: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Outstanding" },
      pending: { cls: "bg-slate-100 text-slate-600 border-slate-200", label: "Pending" },
    };
    const m = map[status] || map.pending;
    return <span className={`status-pill border ${m.cls}`}>{m.label}</span>;
  };

  const isCollector = user?.role === "field_collector" || user?.role === "admin";

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-5 border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg efcis-gradient flex items-center justify-center shadow-md shadow-green-500/25">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 font-heading">Payments</h3>
            <p className="text-xs text-slate-500">Daily collections, outstanding balances, and receipts</p>
          </div>
        </div>

        <Tabs defaultValue="daily" className="w-full">
          <TabsList>
            <TabsTrigger value="daily" data-testid="tab-daily-schedule">
              <Calendar className="w-4 h-4 mr-1.5" /> Daily Schedule
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-payment-history">
              <History className="w-4 h-4 mr-1.5" /> Payment History
            </TabsTrigger>
            <TabsTrigger value="closing" data-testid="tab-closing">
              <ClipboardCheck className="w-4 h-4 mr-1.5" /> Closing Report
            </TabsTrigger>
            <TabsTrigger value="receipts" data-testid="tab-receipts">
              <Receipt className="w-4 h-4 mr-1.5" /> Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-44"
                  data-testid="payments-date"
                />
              </div>
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search borrower or control no…" className="pl-9" data-testid="payments-search" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-[11px] uppercase tracking-wider text-green-700 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Collected</div>
                <div className="text-xl font-bold font-mono text-green-800 mt-0.5">₱ {fmt(totals.collected)}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-[11px] uppercase tracking-wider text-amber-700 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Outstanding</div>
                <div className="text-xl font-bold font-mono text-amber-800 mt-0.5">₱ {fmt(totals.outstanding)}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-600 font-bold">Pending</div>
                <div className="text-xl font-bold font-mono text-slate-700 mt-0.5">₱ {fmt(totals.pending)}</div>
              </div>
            </div>

            <Card className="border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="payments-table">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                    <tr>
                      <th className="px-4 py-3 text-left">Control No.</th>
                      <th className="px-4 py-3 text-left">Borrower</th>
                      <th className="px-4 py-3 text-left">Day</th>
                      <th className="px-4 py-3 text-left">Due Date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
                    ) : filtered.length === 0 ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                        No collections scheduled for this date.
                      </td></tr>
                    ) : (
                      filtered.map((r) => {
                        const overdue = r.due_date < todayISO() && r.status !== "paid";
                        return (
                          <tr key={`${r.loan_id}-${r.day}`} className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${overdue ? "bg-amber-50/30" : ""}`}>
                            <td className="px-4 py-3 font-mono text-xs">{r.control_no}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{r.borrower_name}</div>
                              <div className="text-[11px] text-slate-500">{r.contact_no}</div>
                            </td>
                            <td className="px-4 py-3">{r.day}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{r.due_date}{overdue && <span className="ml-1 text-amber-600 font-semibold">• overdue</span>}</td>
                            <td className="px-4 py-3 text-right font-mono">₱ {fmt(r.amount)}</td>
                            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                            <td className="px-4 py-3">
                              {r.status === "paid" ? (
                                <span className="text-xs text-green-700 font-semibold">{r.receipt_no}</span>
                              ) : isCollector ? (
                                <div className="flex gap-1.5">
                                  <Button size="sm" onClick={() => setCollectRow(r)} className="efcis-gradient text-white h-8" data-testid={`collect-${r.loan_id}-${r.day}`}>
                                    Collect
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setPassRow(r)} className="h-8" data-testid={`pass-${r.loan_id}-${r.day}`}>
                                    Pass
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <PaymentHistoryTab />
          </TabsContent>

          <TabsContent value="closing" className="mt-4">
            <ClosingReportTab />
          </TabsContent>

          <TabsContent value="receipts" className="mt-4">
            <Card className="p-6 border-slate-200">
              <h4 className="text-sm font-bold text-slate-800 mb-3">Daily Summary — {date}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-xs uppercase font-bold text-green-700">Total Collected</div>
                  <div className="text-2xl font-bold text-green-800 font-mono mt-1">₱ {fmt(totals.collected)}</div>
                  <div className="text-xs text-green-700 mt-1">{filtered.filter(r => r.status === "paid").length} payments</div>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-xs uppercase font-bold text-amber-700">Outstanding</div>
                  <div className="text-2xl font-bold text-amber-800 font-mono mt-1">₱ {fmt(totals.outstanding)}</div>
                  <div className="text-xs text-amber-700 mt-1">{filtered.filter(r => r.status === "outstanding").length} unpaid</div>
                </div>
                <div className="p-4 rounded-lg bg-slate-100 border border-slate-200">
                  <div className="text-xs uppercase font-bold text-slate-600">Total Due</div>
                  <div className="text-2xl font-bold text-slate-800 font-mono mt-1">₱ {fmt(totals.collected + totals.outstanding + totals.pending)}</div>
                  <div className="text-xs text-slate-600 mt-1">{filtered.length} scheduled</div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </Card>

      {collectRow && <CollectModal open onClose={() => setCollectRow(null)} row={collectRow} onConfirmed={load} />}
      {passRow && <PassModal open onClose={() => setPassRow(null)} row={passRow} onConfirmed={load} />}
    </div>
  );
}
