import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, STATUS_COLORS } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FolderKanban, FileSignature, Eye } from "lucide-react";
import ContractSOAModal from "@/components/ContractSOAModal";
import LoanManagementViewModal from "@/components/LoanManagementViewModal";

export default function LoanManagementPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [contractApp, setContractApp] = useState(null);
  const [viewApp, setViewApp] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get("/loan-management"),
      api.get("/loan-applications"),
    ])
      .then(([lmRes, laRes]) => {
        if (!mounted) return;
        const lm = lmRes.data || [];
        // Include Scheduled apps from loan_applications so BA can issue Contract & SOA
        const scheduled = (laRes.data || []).filter((x) => x.status === "Scheduled");
        const merged = [...lm, ...scheduled].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setItems(merged);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const filtered = items.filter((i) => {
    const txt = `${i.control_no} ${i.first_name} ${i.surname} ${i.contact_no} ${i.status}`.toLowerCase();
    return txt.includes(q.toLowerCase());
  });

  const isBA = user?.role === "branch_assistant";

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-5 border-slate-200">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg efcis-gradient flex items-center justify-center shadow-md shadow-green-500/25">
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">Loan Management</h3>
              <p className="text-xs text-slate-500">Scheduled, released, ongoing and rejected loans</p>
            </div>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" data-testid="lm-search" />
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="lm-table">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Control No.</th>
                <th className="px-4 py-3 text-left">Borrower</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Loan Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No records yet.</td></tr>
              ) : (
                filtered.map((i) => {
                  const showContract = isBA && i.status === "Scheduled";
                  return (
                    <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{i.control_no}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{[i.first_name, i.middle_name, i.surname, i.suffix].filter(Boolean).join(" ")}</td>
                      <td className="px-4 py-3 text-slate-600">{i.contact_no}</td>
                      <td className="px-4 py-3"><span className={`status-pill ${STATUS_COLORS[i.status] || "bg-slate-100 text-slate-700"}`}>{i.status}</span></td>
                      <td className="px-4 py-3">{i.loan_status ? <span className={`status-pill ${STATUS_COLORS[i.loan_status] || "bg-slate-100 text-slate-700"}`}>{i.loan_status}</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{i.released_at || i.rejected_at ? new Date(i.released_at || i.rejected_at).toLocaleString() : new Date(i.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewApp(i)}
                            data-testid={`lm-view-${i.id}`}
                            className="h-8"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                          {showContract && (
                            <Button
                              size="sm"
                              onClick={() => setContractApp(i)}
                              className="efcis-gradient text-white h-8"
                              data-testid={`lm-contract-${i.id}`}
                            >
                              <FileSignature className="w-3.5 h-3.5 mr-1" /> Contract &amp; SOA
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {contractApp && (
        <ContractSOAModal
          open={!!contractApp}
          onClose={() => setContractApp(null)}
          application={contractApp}
        />
      )}
      {viewApp && (
        <LoanManagementViewModal
          open={!!viewApp}
          onClose={() => setViewApp(null)}
          application={viewApp}
        />
      )}
    </div>
  );
}
