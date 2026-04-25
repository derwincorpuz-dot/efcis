import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, STATUS_COLORS, ROLE_ACTION } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, ArrowRight, Eye } from "lucide-react";
import LoanApplicationModal from "@/components/LoanApplicationModal";

// Map: which status this role acts on
const ACTIONABLE_STATUS = {
  field_collector: ["Draft"],
  branch_assistant: ["New loan", "Draft"],
  branch_manager: ["Processed"],
  verifier: ["Reviewed"],
  area_manager: ["Verified"],
  admin: ["Approved"],
  releasing_officer: ["Scheduled"],
};

export default function LoanApplicationPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/loan-applications");
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const txt = `${i.control_no} ${i.first_name} ${i.middle_name} ${i.surname} ${i.contact_no} ${i.present_address} ${i.collector_name} ${i.status}`.toLowerCase();
      return txt.includes(q.toLowerCase());
    });
  }, [items, q]);

  const onSaved = () => fetchAll();

  const canActOn = (row) => {
    const list = ACTIONABLE_STATUS[user.role] || [];
    return list.includes(row.status);
  };

  const actionLabel = ROLE_ACTION[user.role]?.label || "View";

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (row) => { setEditing(row); setOpen(true); };

  const isFC = user.role === "field_collector";

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-5 border-slate-200">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg efcis-gradient flex items-center justify-center shadow-md shadow-green-500/25">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">Loan Applications</h3>
              <p className="text-xs text-slate-500">{items.length} total {isFC ? "— your submissions" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search applications…" className="pl-9" data-testid="la-search" />
            </div>
            {isFC && (
              <Button onClick={openCreate} className="efcis-gradient text-white shrink-0" data-testid="la-add-button">
                <Plus className="w-4 h-4 mr-1.5" /> Add
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="la-table">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Control No.</th>
                <th className="px-4 py-3 text-left">Date & Time</th>
                <th className="px-4 py-3 text-left">Collector</th>
                <th className="px-4 py-3 text-left">First Name</th>
                <th className="px-4 py-3 text-left">Middle</th>
                <th className="px-4 py-3 text-left">Surname</th>
                <th className="px-4 py-3 text-left">Suffix</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Address</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                  No loan applications yet.{isFC && " Click \"Add\" to create one."}
                </td></tr>
              ) : (
                filtered.map((row) => {
                  const canAct = canActOn(row);
                  const isDraft = row.status === "Draft" && (user.role === "field_collector" || user.role === "branch_assistant");
                  const label = isDraft ? "Continue" : actionLabel;
                  return (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{row.control_no}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">{row.collector_name}</td>
                      <td className="px-4 py-3">{row.first_name}</td>
                      <td className="px-4 py-3">{row.middle_name}</td>
                      <td className="px-4 py-3 font-medium">{row.surname}</td>
                      <td className="px-4 py-3">{row.suffix}</td>
                      <td className="px-4 py-3">{row.contact_no}</td>
                      <td className="px-4 py-3 max-w-[220px] truncate" title={row.present_address}>{row.present_address}</td>
                      <td className="px-4 py-3"><span className={`status-pill ${STATUS_COLORS[row.status] || "bg-slate-100 text-slate-700"}`}>{row.status}</span></td>
                      <td className="px-4 py-3">
                        {canAct ? (
                          <Button size="sm" onClick={() => openEdit(row)} className="efcis-gradient text-white" data-testid={`la-action-${row.id}`}>
                            {label} <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)} data-testid={`la-view-${row.id}`}>
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
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

      {open && (
        <LoanApplicationModal
          open={open}
          onClose={() => setOpen(false)}
          application={editing}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
