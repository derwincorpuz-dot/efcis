import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, FileSignature } from "lucide-react";

const fmt = (n) => {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function calcLoanProceeds({ approved, terms }) {
  const A = Number(approved) || 0;
  const t = Number(terms) || 0;
  const rate = t === 60 ? 0.20 : t === 80 ? 0.22 : 0;
  const totalWithInterest = A + A * rate;
  const daily = t > 0 ? totalWithInterest / t : 0;
  const insurance = A * 0.01;
  let notarial = 0;
  if (A >= 5000 && A <= 50000) notarial = 150;
  else if (A <= 100000) notarial = 250;
  else if (A <= 300000) notarial = 300;
  const released = A - insurance - notarial;
  return { rate, totalWithInterest, daily, insurance, notarial, released };
}

export default function ContractSOAModal({ open, onClose, application }) {
  const printRef = useRef(null);
  if (!application) return null;
  const d = application.data || {};
  const term = Number(d.approved_terms || 0);
  const p = calcLoanProceeds({ approved: d.approved_amount, terms: term });
  const fullName = [d.first_name, d.middle_name, d.surname, d.suffix].filter(Boolean).join(" ");
  const startDate = d.release_date ? new Date(d.release_date) : null;
  const rows = [];
  if (startDate && term > 0) {
    for (let i = 1; i <= term; i++) {
      const dt = new Date(startDate.getTime());
      dt.setDate(dt.getDate() + i);
      rows.push({ day: i, date: dt.toLocaleDateString(), amount: p.daily });
    }
  }

  const handlePrint = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Contract & SOA — ${application.control_no}</title>
      <style>
        body{font-family:'IBM Plex Sans',sans-serif;color:#0F172A;padding:32px;}
        h1,h2,h3,h4{font-family:'Manrope',sans-serif;}
        table{width:100%;border-collapse:collapse;margin-top:8px;}
        th,td{border:1px solid #cbd5e1;padding:6px 8px;font-size:12px;text-align:left;}
        thead{background:#f1f5f9;text-transform:uppercase;font-size:10px;letter-spacing:0.05em;}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:13px;}
        .grid div{display:flex;flex-direction:column;}
        .lbl{font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;}
        .val{font-weight:600;}
        .sec{margin-top:18px;border-top:2px solid #16A34A;padding-top:10px;}
        .pill{display:inline-block;background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;}
        .right{text-align:right;font-family:'JetBrains Mono',monospace;}
        @media print { @page { margin:14mm; } }
      </style></head><body>${html}<script>window.onload=()=>{window.print();}</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl w-[96vw] max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2 font-heading">
            <FileSignature className="w-5 h-5 text-green-600" />
            Contract & SOA — {application.control_no}
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="px-6 py-5 space-y-5 text-sm">
          <div className="text-center">
            <h2 className="text-xl font-extrabold text-slate-900 font-heading">EFCIS LOAN CONTRACT</h2>
            <p className="text-xs text-slate-500 mt-1">Easy Finance Credit Investigation Services</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Control No.: <span className="font-mono">{application.control_no}</span></p>
          </div>

          <div className="sec">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Borrower Information</h4>
            <div className="grid">
              <div><span className="lbl">Full Name</span><span className="val">{fullName || "—"}</span></div>
              <div><span className="lbl">Contact No.</span><span className="val">{d.contact_no || "—"}</span></div>
              <div><span className="lbl">Civil Status</span><span className="val">{d.civil_status || "—"}</span></div>
              <div><span className="lbl">Gender</span><span className="val">{d.gender || "—"}</span></div>
              <div><span className="lbl">Date of Birth</span><span className="val">{d.dob || "—"}</span></div>
              <div><span className="lbl">Place of Birth</span><span className="val">{d.pob || "—"}</span></div>
              <div style={{ gridColumn: "1 / -1" }}><span className="lbl">Present Address</span><span className="val">{d.present_address || "—"}</span></div>
            </div>
          </div>

          <div className="sec">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Loan Terms</h4>
            <div className="grid">
              <div><span className="lbl">Approved Amount</span><span className="val">₱ {fmt(d.approved_amount)}</span></div>
              <div><span className="lbl">Terms</span><span className="val">{term} days</span></div>
              <div><span className="lbl">Interest Rate</span><span className="val">{(p.rate * 100).toFixed(0)}%</span></div>
              <div><span className="lbl">Total w/ Interest</span><span className="val">₱ {fmt(p.totalWithInterest)}</span></div>
              <div><span className="lbl">Daily Payment</span><span className="val">₱ {fmt(p.daily)}</span></div>
              <div><span className="lbl">Insurance (1%)</span><span className="val">₱ {fmt(p.insurance)}</span></div>
              <div><span className="lbl">Notarial Fee</span><span className="val">₱ {fmt(p.notarial)}</span></div>
              <div><span className="lbl">Released Amount</span><span className="val">₱ {fmt(p.released)}</span></div>
              <div><span className="lbl">Release Schedule</span><span className="val">{d.release_date || "—"}</span></div>
              <div><span className="lbl">Status</span><span className="pill">{application.status}</span></div>
            </div>
          </div>

          <div className="sec">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Co-Makers & Witness</h4>
            <div className="grid">
              <div><span className="lbl">Co-Maker 1</span><span className="val">{d.comaker1_name || "—"}</span></div>
              <div><span className="lbl">Address</span><span className="val">{d.comaker1_addr || "—"}</span></div>
              <div><span className="lbl">Co-Maker 2</span><span className="val">{d.comaker2_name || "—"}</span></div>
              <div><span className="lbl">Address</span><span className="val">{d.comaker2_addr || "—"}</span></div>
              <div><span className="lbl">Witness</span><span className="val">{d.witness_name || "—"}</span></div>
              <div><span className="lbl">Address</span><span className="val">{d.witness_addr || "—"}</span></div>
            </div>
          </div>

          <div className="sec">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Statement of Account (SOA)</h4>
            <table>
              <thead>
                <tr><th>Day</th><th>Date</th><th className="right">Daily Payment</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", color: "#94a3b8" }}>No SOA — release date or terms missing.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.day}>
                    <td>{r.day}</td>
                    <td>{r.date}</td>
                    <td className="right">₱ {fmt(r.amount)}</td>
                    <td>Pending</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
                    <td colSpan={2}>TOTAL</td>
                    <td className="right">₱ {fmt(p.totalWithInterest)}</td>
                    <td>—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="sec" style={{ marginTop: 32 }}>
            <div className="grid" style={{ marginTop: 24 }}>
              <div>
                <span className="lbl">Borrower's Signature</span>
                <div style={{ borderBottom: "1px solid #0F172A", height: 28, marginTop: 24 }} />
                <span className="val" style={{ marginTop: 4 }}>{fullName}</span>
              </div>
              <div>
                <span className="lbl">Authorized Representative</span>
                <div style={{ borderBottom: "1px solid #0F172A", height: 28, marginTop: 24 }} />
                <span className="val" style={{ marginTop: 4 }}>EFCIS Branch Assistant</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 px-5 py-3 flex items-center gap-2 justify-between">
          <Button variant="ghost" onClick={onClose} data-testid="contract-close">
            <X className="w-4 h-4 mr-1.5" /> Close
          </Button>
          <Button onClick={handlePrint} className="efcis-gradient text-white" data-testid="contract-print">
            <Printer className="w-4 h-4 mr-1.5" /> Print Contract & SOA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
