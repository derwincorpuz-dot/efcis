import React, { useEffect, useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Printer, X, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

const fmt = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReceiptModal({ open, onClose, receipt }) {
  const ref = useRef(null);
  if (!receipt) return null;

  const print = () => {
    const html = ref.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=420,height=600");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Receipt — ${receipt.receipt_no}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body{font-family:'Courier New', monospace; color:#000; font-size:11pt; padding:6px;}
        .center{text-align:center;}
        .row{display:flex; justify-content:space-between; gap:8px;}
        .b{font-weight:700;}
        hr{border:none; border-top:1px dashed #000; margin:6px 0;}
        .total{font-size:13pt; font-weight:700;}
      </style></head><body>${html}<script>window.onload=()=>setTimeout(()=>window.print(),200);</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-sm p-0 sm:rounded-2xl">
        <DialogHeader className="px-5 py-4 border-b border-slate-200">
          <DialogTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2 font-heading">
            <CheckCircle2 className="w-5 h-5 text-green-600" /> Payment Receipt
          </DialogTitle>
        </DialogHeader>
        <div className="p-5">
          <div ref={ref} className="bg-white p-4 border border-dashed border-slate-300 rounded-md font-mono text-[12px]">
            <div className="text-center font-bold">EFCIS LMS</div>
            <div className="text-center text-[10px]">Easy Finance Credit Investigation Services</div>
            <div className="text-center text-[10px]">Landing Road, Brgy. Ibabang Iyam, Lucena City</div>
            <hr />
            <div className="row flex justify-between"><span>Receipt No.</span><span className="b font-bold">{receipt.receipt_no}</span></div>
            <div className="row flex justify-between"><span>Date</span><span>{new Date(receipt.action_at).toLocaleString()}</span></div>
            <div className="row flex justify-between"><span>Collector</span><span>{receipt.action_by_name}</span></div>
            <hr />
            <div className="row flex justify-between"><span>Control No.</span><span className="b font-bold">{receipt.control_no}</span></div>
            <div className="row flex justify-between"><span>Borrower</span><span>{receipt.borrower_name}</span></div>
            <div className="row flex justify-between"><span>Day</span><span>{receipt.day}</span></div>
            <div className="row flex justify-between"><span>Due Date</span><span>{receipt.due_date}</span></div>
            <hr />
            <div className="row flex justify-between total text-base font-bold">
              <span>AMOUNT PAID</span>
              <span>₱ {fmt(receipt.amount)}</span>
            </div>
            <hr />
            <div className="text-center text-[10px] mt-2">Thank you for your payment.</div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex items-center gap-2 justify-between">
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4 mr-1.5" /> Close</Button>
          <Button onClick={print} className="efcis-gradient text-white" data-testid="receipt-print">
            <Printer className="w-4 h-4 mr-1.5" /> Print Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PassModal({ open, onClose, row, onConfirmed }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) { toast.error("Please enter a remark"); return; }
    setSaving(true);
    try {
      await api.post("/payments/pass", { loan_id: row.loan_id, day: row.day, amount: row.amount, reason });
      toast.success("Marked as outstanding");
      onConfirmed();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-md sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold text-slate-900 font-heading">Pass / Due Remark</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-sm bg-slate-50 border border-slate-200 rounded-md p-3">
            <div className="font-semibold">{row?.borrower_name}</div>
            <div className="text-xs text-slate-500">Day {row?.day} • Due {row?.due_date} • ₱ {fmt(row?.amount)}</div>
          </div>
          <Textarea
            placeholder="Reason for passing (e.g., not at home, no funds, requested extension)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="pass-reason"
            rows={4}
          />
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            This payment will be marked outstanding until paid.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="efcis-gradient text-white" data-testid="pass-confirm">
            {saving ? "Saving…" : "Mark Outstanding"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CollectModal({ open, onClose, row, onConfirmed }) {
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const submit = async () => {
    setSaving(true);
    try {
      const { data } = await api.post("/payments/collect", { loan_id: row.loan_id, day: row.day, amount: row.amount });
      // Enrich for receipt
      setReceipt({
        ...data,
        control_no: row.control_no,
        borrower_name: row.borrower_name,
        due_date: row.due_date,
      });
      toast.success("Payment collected");
      onConfirmed();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally { setSaving(false); }
  };

  if (receipt) {
    return <ReceiptModal open onClose={() => { setReceipt(null); onClose(); }} receipt={receipt} />;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-md sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold text-slate-900 font-heading">Confirm Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Borrower</span><span className="font-semibold">{row?.borrower_name}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Control No.</span><span className="font-mono text-xs">{row?.control_no}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Day</span><span>{row?.day}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Due Date</span><span>{row?.due_date}</span></div>
            <hr className="my-2 border-slate-200" />
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Amount</span>
              <span className="text-2xl font-bold text-green-700">₱ {fmt(row?.amount)}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="efcis-gradient text-white" data-testid="collect-confirm">
            {saving ? "Processing…" : "Confirm & Issue Receipt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
