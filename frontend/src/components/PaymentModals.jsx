import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Printer, X, CheckCircle2, Download } from "lucide-react";
import html2canvas from "html2canvas";
import { api } from "@/lib/api";
import { toast } from "sonner";

const fmt = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReceiptModal({ open, onClose, receipt }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  if (!receipt) return null;

  const date = new Date(receipt.action_at);

  const saveJpg = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff", scale: 2 });
      const url = canvas.toDataURL("image/jpeg", 0.95);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Receipt_${receipt.receipt_no}.jpg`;
      a.click();
      toast.success("Receipt saved");
    } catch (e) {
      toast.error("Failed to save");
    } finally { setBusy(false); }
  };

  const printIt = () => {
    if (!ref.current) return;
    const html = ref.current.outerHTML;
    const w = window.open("", "_blank", "width=400,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Receipt</title>
      <style>
        @page { size: 58mm auto; margin: 2mm; }
        body{ margin:0; font-family:'Courier New', monospace; }
      </style></head><body>${html}<script>window.onload=()=>setTimeout(()=>window.print(),200);</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] max-w-sm p-0 sm:rounded-2xl">
        <DialogHeader className="px-5 py-4 border-b border-slate-200">
          <DialogTitle className="text-base font-extrabold text-slate-900 flex items-center gap-2 font-heading">
            <CheckCircle2 className="w-5 h-5 text-green-600" /> Receipt Preview
          </DialogTitle>
        </DialogHeader>
        <div className="p-5 bg-slate-100 flex justify-center">
          {/* 58mm thermal receipt — at ~3.78px per mm = ~220px wide, scale up for clarity */}
          <div
            ref={ref}
            style={{
              width: 280,
              minHeight: 380,
              background: "#fff",
              padding: "14px 12px",
              fontFamily: "'Courier New', monospace",
              fontSize: 12,
              color: "#000",
              lineHeight: 1.4,
            }}
          >
            <div style={{ textAlign: "center", fontWeight: 700, fontSize: 14 }}>EFCIS LMS</div>
            <div style={{ textAlign: "center" }}>Lending Management System</div>
            <div style={{ textAlign: "center" }}>Collector</div>
            <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
            <div><b>RCP No:</b> {receipt.receipt_no}</div>
            <div><b>Date:</b> {date.toLocaleDateString()}</div>
            <div><b>Time:</b> {date.toLocaleString()}</div>
            <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ fontWeight: 700 }}>RECEIVED FROM:</div>
            <div style={{ textTransform: "uppercase" }}>{receipt.borrower_name}</div>
            <div><b>Loan ID:</b> {receipt.control_no}</div>
            <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ fontWeight: 700 }}>PAYMENT DETAILS</div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Amount Paid:</span>
              <span style={{ fontWeight: 700 }}>PHP {fmt(receipt.amount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Method:</span>
              <span style={{ fontWeight: 700 }}>CASH</span>
            </div>
            <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ fontWeight: 700 }}>PROCESSED BY:</div>
            <div style={{ textTransform: "uppercase" }}>{receipt.action_by_name}</div>
            <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
            <div style={{ textAlign: "center", fontWeight: 700, marginTop: 6 }}>THANK YOU!</div>
            <div style={{ textAlign: "center", fontSize: 11 }}>Please keep this receipt</div>
            <div style={{ textAlign: "center", fontSize: 11 }}>for your records.</div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex items-center gap-2 justify-between">
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4 mr-1.5" /> Close</Button>
          <div className="flex gap-2">
            <Button onClick={printIt} variant="outline" data-testid="receipt-print">
              <Printer className="w-4 h-4 mr-1.5" /> Print
            </Button>
            <Button onClick={saveJpg} disabled={busy} className="efcis-gradient text-white" data-testid="receipt-save-jpg">
              <Download className="w-4 h-4 mr-1.5" /> {busy ? "Saving…" : "Save as JPG"}
            </Button>
          </div>
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
