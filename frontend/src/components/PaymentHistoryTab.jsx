import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Calendar } from "lucide-react";

const fmt = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PaymentHistoryTab() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get("/payments/history-by-client").then((r) => setItems(r.data || [])).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((i) => {
    const t = `${i.control_no} ${i.borrower_name} ${i.contact_no}`.toLowerCase();
    return t.includes(q.toLowerCase());
  });

  const StatusDot = ({ status }) => {
    const map = { paid: "bg-green-500", outstanding: "bg-amber-500", pending: "bg-slate-300" };
    return <span className={`inline-block w-2.5 h-2.5 rounded-full ${map[status] || "bg-slate-300"}`} title={status} />;
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-slate-200">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search borrower or control no…" className="pl-9" data-testid="ph-search" />
        </div>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <Card className="p-8 text-center text-slate-400">Loading…</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-slate-400">No released clients yet.</Card>
        ) : filtered.map((c) => {
          const open = expanded === c.loan_id;
          return (
            <Card key={c.loan_id} className="border-slate-200 overflow-hidden">
              <button
                onClick={() => setExpanded(open ? null : c.loan_id)}
                className="w-full px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                data-testid={`ph-toggle-${c.loan_id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-bold text-slate-900">{c.borrower_name}</div>
                    <div className="font-mono text-xs text-slate-500">{c.control_no}</div>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Released {c.release_date || "—"}</span>
                    <span>{c.contact_no}</span>
                  </div>
                  <div className="mt-2 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full efcis-gradient" style={{ width: `${c.totals.progress}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-right shrink-0">
                  <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold">Paid</div>
                    <div className="font-mono font-bold text-green-700">₱ {fmt(c.totals.paid)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold">Outstanding</div>
                    <div className="font-mono font-bold text-amber-700">₱ {fmt(c.totals.outstanding)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold">Pending</div>
                    <div className="font-mono font-bold text-slate-700">₱ {fmt(c.totals.pending)}</div>
                  </div>
                </div>
              </button>
              {open && (
                <div className="border-t border-slate-100 p-4 bg-slate-50/40">
                  <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
                    {c.days.map((d) => (
                      <div
                        key={d.day}
                        className={`relative aspect-square rounded-md border text-[10px] flex flex-col items-center justify-center cursor-default transition-colors ${
                          d.status === "paid" ? "bg-green-100 border-green-300 text-green-800"
                            : d.status === "outstanding" ? "bg-amber-100 border-amber-300 text-amber-800"
                            : "bg-white border-slate-200 text-slate-500"
                        }`}
                        title={`Day ${d.day} • ${d.due_date} • ${d.status}`}
                      >
                        <div className="font-bold">{d.day}</div>
                        <div className="text-[8px] mt-0.5">{d.due_date.slice(5)}</div>
                        <StatusDot status={d.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
