import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Eye, X, FileSignature, MapPin, Camera, FileText } from "lucide-react";
import LocationHistory, { buildLocationItems } from "@/components/LocationHistory";
import ContractSOAModal from "@/components/ContractSOAModal";
import { STATUS_COLORS } from "@/lib/api";

const fmt = (n) => Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Row({ k, v }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wider text-slate-400">{k}</span>
      <span className="text-sm text-slate-800 font-medium">{v || "—"}</span>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div className="border border-slate-200 rounded-xl bg-white p-4">
      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">{title}</h5>
      {children}
    </div>
  );
}

function PhotoGrid({ photos }) {
  const list = photos.filter((p) => p.dataUrl);
  if (list.length === 0) return <div className="text-sm text-slate-400">No photos.</div>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {list.map((p, i) => (
        <div key={i} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
          <img src={p.dataUrl} alt={p.label} className="w-full aspect-square object-cover" />
          <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-700 truncate">{p.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function LoanManagementViewModal({ open, onClose, application }) {
  const [contract, setContract] = useState(false);
  if (!application) return null;
  const d = application.data || {};
  const fullName = [d.first_name, d.middle_name, d.surname, d.suffix].filter(Boolean).join(" ");
  const term = Number(d.approved_terms || 0);
  const rate = term === 60 ? 0.20 : term === 80 ? 0.22 : 0;
  const total = (Number(d.approved_amount) || 0) * (1 + rate);
  const daily = term > 0 ? total / term : 0;

  const photos = [
    { label: "Client (2×2)", dataUrl: d.client_photo?.dataUrl },
    { label: "Home (Collector)", dataUrl: d.home_photo?.dataUrl },
    { label: "Store (Collector)", dataUrl: d.store_photo?.dataUrl },
    { label: "Valid ID 1", dataUrl: d.id1_photo?.dataUrl },
    { label: "Valid ID 2", dataUrl: d.id2_photo?.dataUrl },
    { label: "Item 1", dataUrl: d.item1_photo?.dataUrl },
    { label: "Item 2", dataUrl: d.item2_photo?.dataUrl },
    { label: "Item 3", dataUrl: d.item3_photo?.dataUrl },
    { label: "Permit Front", dataUrl: d.permit_front?.dataUrl },
    { label: "Permit Back", dataUrl: d.permit_back?.dataUrl },
    { label: "Home (Verifier)", dataUrl: d.verifier_home_photo?.dataUrl },
    { label: "Store (Verifier)", dataUrl: d.verifier_store_photo?.dataUrl },
    { label: "Releasing Proof", dataUrl: d.release_proof?.dataUrl },
    { label: "Loan Contract Photo", dataUrl: d.contract_photo?.dataUrl },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[98vw] max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[95vh] overflow-y-auto p-0 sm:rounded-2xl">
        <DialogHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2 font-heading">
            <Eye className="w-5 h-5 text-green-600" />
            Loan Record — {application.control_no}
            <span className={`status-pill ml-2 ${STATUS_COLORS[application.status] || "bg-slate-100"}`}>{application.status}</span>
            {application.loan_status && (
              <span className={`status-pill ${STATUS_COLORS[application.loan_status] || "bg-slate-100"}`}>{application.loan_status}</span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {fullName} • Created {application.created_at ? new Date(application.created_at).toLocaleString() : "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="info" data-testid="lvm-tab-info"><FileText className="w-4 h-4 mr-1.5" /> Information</TabsTrigger>
              <TabsTrigger value="photos" data-testid="lvm-tab-photos"><Camera className="w-4 h-4 mr-1.5" /> Photos</TabsTrigger>
              <TabsTrigger value="locations" data-testid="lvm-tab-locations"><MapPin className="w-4 h-4 mr-1.5" /> Location History</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4 space-y-3">
              <Block title="Borrower">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Row k="Full Name" v={fullName} />
                  <Row k="Contact" v={d.contact_no} />
                  <Row k="Civil Status" v={d.civil_status} />
                  <Row k="Gender" v={d.gender} />
                  <Row k="Date of Birth" v={d.dob} />
                  <Row k="Place of Birth" v={d.pob} />
                  <Row k="Citizenship" v={d.citizenship} />
                  <Row k="Religion" v={d.religion} />
                  <Row k="Address" v={d.present_address} />
                  <Row k="Length of Stay" v={d.length_of_stay} />
                  <Row k="Ownership" v={d.ownership_type} />
                </div>
              </Block>

              <Block title="Business / Employment">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Row k="Business Type" v={d.bus_type} />
                  <Row k="Business Address" v={d.bus_addr} />
                  <Row k="Length of Business" v={d.bus_length} />
                  <Row k="Gross Daily Income" v={d.bus_gross_daily} />
                  <Row k="Capital" v={d.bus_capital} />
                  <Row k="Employer" v={d.emp_company} />
                  <Row k="Position" v={d.emp_position} />
                  <Row k="Salary" v={d.emp_salary} />
                </div>
              </Block>

              <Block title="Spouse">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Row k="Spouse Name" v={d.spouse_name} />
                  <Row k="Spouse Contact" v={d.spouse_contact} />
                  <Row k="Spouse DOB" v={d.spouse_dob} />
                  <Row k="Spouse Citizenship" v={d.spouse_citizenship} />
                </div>
              </Block>

              <Block title="Co-Makers / Witness">
                <div className="grid grid-cols-2 gap-3">
                  <Row k="Co-Maker 1" v={d.comaker1_name} />
                  <Row k="Address" v={d.comaker1_addr} />
                  <Row k="Co-Maker 2" v={d.comaker2_name} />
                  <Row k="Address" v={d.comaker2_addr} />
                  <Row k="Witness" v={d.witness_name} />
                  <Row k="Address" v={d.witness_addr} />
                </div>
              </Block>

              <Block title="Loan Terms">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Row k="Amount Applied" v={fmt(d.amount_applied)} />
                  <Row k="Approved Amount" v={`₱ ${fmt(d.approved_amount)}`} />
                  <Row k="Terms (days)" v={term} />
                  <Row k="Interest Rate" v={`${(rate * 100).toFixed(0)}%`} />
                  <Row k="Total w/ Interest" v={`₱ ${fmt(total)}`} />
                  <Row k="Daily Payment" v={`₱ ${fmt(daily)}`} />
                  <Row k="Release Date" v={d.release_date} />
                </div>
              </Block>

              <Block title="Workflow History">
                <div className="space-y-1.5 text-sm">
                  {(application.step_history || []).map((h, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-slate-100 pb-1 last:border-0">
                      <div>
                        <span className="font-semibold text-slate-800">{h.by_name}</span>
                        <span className="text-xs text-slate-500 ml-2">({h.role})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">{h.status}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{h.at ? new Date(h.at).toLocaleString() : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Block>
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              <Block title="All Captured Photos"><PhotoGrid photos={photos} /></Block>
            </TabsContent>

            <TabsContent value="locations" className="mt-4">
              <LocationHistory items={buildLocationItems(d)} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 px-5 py-3 flex items-center gap-2 justify-between">
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4 mr-1.5" /> Close</Button>
          <Button onClick={() => setContract(true)} className="efcis-gradient text-white" data-testid="lvm-open-contract">
            <FileSignature className="w-4 h-4 mr-1.5" /> Contract &amp; SOA
          </Button>
        </div>

        {contract && (
          <ContractSOAModal open onClose={() => setContract(false)} application={application} />
        )}
      </DialogContent>
    </Dialog>
  );
}
