import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { BadgeDollarSign, Wallet, Landmark, ArrowDownUp, CheckCircle2, XCircle, Plus, Download } from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TX_TYPES = [
  { value: "revenue", label: "Revenue (in)", help: "Branch sales, validated collections, etc." },
  { value: "expense", label: "Petty Cash Expense (out)", help: "Office supplies, fuel, snacks, utilities" },
  { value: "disbursement", label: "Loan Disbursement (out)", help: "Actual loan proceeds released to borrower" },
];

const STATUS_STYLE = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  validated: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function TxModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ type: "revenue", account: "cash", amount: "", category: "", description: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const a = Number(form.amount);
    if (!a || a <= 0) { toast.error("Amount must be > 0"); return; }
    setSaving(true);
    try {
      await api.post("/financial/transactions", { ...form, amount: a });
      toast.success("Transaction recorded");
      onSaved();
      onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };
  const typeHelp = TX_TYPES.find((t) => t.value === form.type)?.help;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-lg sm:rounded-2xl">
        <DialogHeader><DialogTitle className="font-heading font-extrabold text-base">Record Transaction</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger data-testid="tx-type"><SelectValue /></SelectTrigger>
              <SelectContent>{TX_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            {typeHelp && <p className="text-[11px] text-slate-500 mt-1">{typeHelp}</p>}
          </div>
          <div>
            <Label className="text-xs">Account</Label>
            <Select value={form.account} onValueChange={(v) => setForm({ ...form, account: v })}>
              <SelectTrigger data-testid="tx-account"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash on Hand</SelectItem>
                <SelectItem value="bank">Bank Account</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Amount (₱)</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="tx-amount" />
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g., Office supplies, Fuel, Loan #EFCIS-..." />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="efcis-gradient text-white" data-testid="tx-save">{saving ? "Saving…" : "Record"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransferModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ from: "cash", to: "bank", amount: "", description: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const a = Number(form.amount);
    if (!a || a <= 0) { toast.error("Amount must be > 0"); return; }
    if (form.from === form.to) { toast.error("From and To must differ"); return; }
    setSaving(true);
    try {
      await api.post("/financial/transfer", { ...form, amount: a });
      toast.success("Transfer recorded");
      onSaved();
      onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-md sm:rounded-2xl">
        <DialogHeader><DialogTitle className="font-heading font-extrabold text-base">Cash ⇄ Bank Transfer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Select value={form.from} onValueChange={(v) => setForm({ ...form, from: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Select value={form.to} onValueChange={(v) => setForm({ ...form, to: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Amount (₱)</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="transfer-amount" />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="efcis-gradient text-white" data-testid="transfer-save">{saving ? "Saving…" : "Transfer"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FinancialPage() {
  const { user } = useAuth();
  const [balances, setBalances] = useState({ cash: 0, bank: 0, total: 0 });
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [openTx, setOpenTx] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);

  const canRecord = ["admin", "branch_assistant"].includes(user?.role);
  const canValidate = ["admin", "area_manager"].includes(user?.role);
  const isAdmin = user?.role === "admin";

  const load = async () => {
    const [b, t] = await Promise.all([
      api.get("/financial/balances").then((r) => r.data),
      api.get("/financial/transactions").then((r) => r.data),
    ]);
    setBalances(b || { cash: 0, bank: 0, total: 0 });
    setItems(t || []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "pending") return items.filter((i) => i.status === "pending");
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  const validateTx = async (tx, decision) => {
    try {
      await api.post(`/financial/transactions/${tx.id}/validate`, { decision });
      toast.success(`Marked ${decision}`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const totals = useMemo(() => {
    const v = items.filter((i) => i.status === "validated");
    return {
      revenue: v.filter((i) => i.type === "revenue").reduce((s, i) => s + i.amount, 0),
      expense: v.filter((i) => i.type === "expense").reduce((s, i) => s + i.amount, 0),
      disbursement: v.filter((i) => i.type === "disbursement").reduce((s, i) => s + i.amount, 0),
      pending_count: items.filter((i) => i.status === "pending").length,
    };
  }, [items]);

  const exportCsv = () => {
    const headers = ["Date", "Type", "Account", "Amount", "Category", "Description", "Recorded By", "Status", "Validated By"];
    const lines = [headers.join(",")];
    items.forEach((r) => {
      const row = [r.recorded_at, r.type, r.account, r.amount, r.category, (r.description || "").replace(/,/g, ";"), r.recorded_by_name, r.status, r.validated_by_name || ""];
      lines.push(row.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Financial_Ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-5 border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg efcis-gradient flex items-center justify-center shadow-md shadow-green-500/25">
            <BadgeDollarSign className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900 font-heading">Financial Management</h3>
            <p className="text-xs text-slate-500">Branch revenue, petty cash, loan disbursements & accounts</p>
          </div>
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-1.5" /> Export CSV</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase font-bold text-slate-500 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Cash on Hand</div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1">₱ {fmt(balances.cash)}</div>
        </Card>
        <Card className="p-4 border-slate-200">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase font-bold text-slate-500 flex items-center gap-1"><Landmark className="w-3.5 h-3.5" /> Bank Account</div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1">₱ {fmt(balances.bank)}</div>
        </Card>
        <Card className="p-4 border-green-200 bg-green-50">
          <div className="text-xs uppercase font-bold text-green-700">Branch Sales (Revenue)</div>
          <div className="text-2xl font-bold text-green-800 font-mono mt-1">₱ {fmt(totals.revenue)}</div>
          <div className="text-[11px] text-green-700 mt-0.5">Validated only</div>
        </Card>
        <Card className="p-4 border-amber-200 bg-amber-50">
          <div className="text-xs uppercase font-bold text-amber-700">Pending Validation</div>
          <div className="text-2xl font-bold text-amber-800 font-mono mt-1">{totals.pending_count}</div>
          <div className="text-[11px] text-amber-700 mt-0.5">Awaiting Area Manager</div>
        </Card>
      </div>

      <Card className="border-slate-200">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-800 font-heading">Transactions</h4>
            <p className="text-xs text-slate-500">{items.length} total • Revenue ₱{fmt(totals.revenue)} • Expenses ₱{fmt(totals.expense)} • Disbursements ₱{fmt(totals.disbursement)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending only</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="disbursement">Disbursement</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button variant="outline" onClick={() => setOpenTransfer(true)} data-testid="open-transfer">
                <ArrowDownUp className="w-4 h-4 mr-1.5" /> Transfer
              </Button>
            )}
            {canRecord && (
              <Button onClick={() => setOpenTx(true)} className="efcis-gradient text-white" data-testid="open-tx">
                <Plus className="w-4 h-4 mr-1.5" /> New Transaction
              </Button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="tx-table">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Recorded By</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No transactions.</td></tr>
              ) : filtered.map((r) => {
                const sign = r.cash_delta + r.bank_delta;
                return (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-xs text-slate-500 font-mono whitespace-nowrap">{new Date(r.recorded_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 capitalize"><span className="status-pill bg-slate-100 text-slate-700 border border-slate-200">{r.type}</span></td>
                    <td className="px-4 py-2.5 capitalize">{r.account}</td>
                    <td className={`px-4 py-2.5 text-right font-mono font-bold ${sign >= 0 ? "text-green-700" : "text-red-700"}`}>
                      {sign >= 0 ? "+" : "−"} ₱ {fmt(Math.abs(r.amount))}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate" title={r.category}>{r.category || "—"}</td>
                    <td className="px-4 py-2.5">
                      <div>{r.recorded_by_name}</div>
                      <div className="text-[10px] text-slate-500">{r.recorded_by_role}</div>
                    </td>
                    <td className="px-4 py-2.5"><span className={`status-pill border ${STATUS_STYLE[r.status] || ""}`}>{r.status}</span></td>
                    <td className="px-4 py-2.5">
                      {r.status === "pending" && canValidate ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => validateTx(r, "validated")} className="efcis-gradient text-white h-8" data-testid={`tx-validate-${r.id}`}><CheckCircle2 className="w-3.5 h-3.5" /></Button>
                          <Button size="sm" variant="outline" onClick={() => validateTx(r, "rejected")} className="text-red-600 h-8" data-testid={`tx-reject-${r.id}`}><XCircle className="w-3.5 h-3.5" /></Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">{r.validated_by_name || "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {openTx && <TxModal open onClose={() => setOpenTx(false)} onSaved={load} />}
      {openTransfer && <TransferModal open onClose={() => setOpenTransfer(false)} onSaved={load} />}
    </div>
  );
}
