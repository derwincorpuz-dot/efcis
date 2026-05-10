import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { api, STATUS_COLORS } from "@/lib/api";
import { toast } from "sonner";
import CameraCapture from "@/components/CameraCapture";
import {
  Save, FileText, ChevronRight, ChevronLeft, Plus, Trash2, MapPin, X,
  CheckCircle2, XCircle, Calendar, ImageIcon, AlertCircle
} from "lucide-react";

const CIVIL_STATUSES = ["Single", "Married", "Widowed", "Separated", "Divorced"];
const GENDERS = ["Male", "Female", "Other"];
const ID_TYPES = ["Driver's License", "Passport", "UMID", "SSS", "PhilHealth", "TIN", "PRC", "Voter's ID", "Postal ID", "National ID"];

function age(dob) {
  if (!dob) return "";
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

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
  return {
    interest_rate: rate,
    total_with_interest: totalWithInterest,
    daily_payment: daily,
    insurance,
    notarial,
    released,
  };
}

const fmt = (n) => {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function FieldGrid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Section({ title, children }) {
  return (
    <div className="bg-slate-50/60 border border-slate-200 rounded-xl p-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", testid, ...rest }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} data-testid={testid} {...rest} />
    </div>
  );
}

function ReviewBlock({ title, fields = [], photos = [] }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{title}</h5>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {fields.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wider text-slate-400">{k}</span>
            <span className="text-slate-800 font-medium">{v || "—"}</span>
          </div>
        ))}
      </div>
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((p, idx) => p?.dataUrl ? (
            <div key={idx} className="relative">
              <img src={p.dataUrl} alt={p.label} className="w-full aspect-video object-cover rounded-md border border-slate-200" />
              <span className="absolute bottom-1 left-1 right-1 text-[10px] bg-black/60 text-white px-1 py-0.5 rounded truncate">
                {p.label}{p.location ? ` 📍 ${p.location.lat.toFixed(3)},${p.location.lng.toFixed(3)}` : ""}
              </span>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
}

export default function LoanApplicationModal({ open, onClose, application, onSaved }) {
  const { user } = useAuth();
  const [data, setData] = useState(application?.data || {});
  const [saving, setSaving] = useState(false);
  const [stepView, setStepView] = useState(1); // for FC step 1<->2
  const isNew = !application;

  // Determine which step this user should fill based on role + current status
  const userStep = useMemo(() => {
    const r = user?.role;
    if (r === "field_collector") return stepView; // 1 or 2
    if (r === "branch_assistant") return 3;
    if (r === "branch_manager") return 4;
    if (r === "verifier") return 5;
    if (r === "area_manager") return 6;
    if (r === "admin") return 7;
    if (r === "releasing_officer") return 8;
    return 1;
  }, [user, stepView]);

  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const persist = async (status, extra = {}) => {
    setSaving(true);
    try {
      const newData = { ...data, ...extra };
      if (isNew) {
        const { data: created } = await api.post("/loan-applications", { data: newData, status });
        toast.success(`Saved as ${status}`);
        onSaved(created);
      } else {
        const { data: updated } = await api.put(`/loan-applications/${application.id}`, { data: newData, status });
        toast.success(`Saved as ${status}`);
        onSaved(updated);
      }
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const reject = async () => {
    const reason = window.prompt("Rejection reason?");
    if (reason === null) return;
    setSaving(true);
    try {
      await api.post(`/loan-applications/${application.id}/reject`, { reason });
      toast.success("Application rejected and moved to Loan Management");
      onSaved(null);
      onClose();
    } catch (e) {
      toast.error("Failed to reject");
    } finally { setSaving(false); }
  };

  const release = async () => {
    setSaving(true);
    try {
      await api.put(`/loan-applications/${application.id}`, { data, status: "Released" });
      await api.post(`/loan-applications/${application.id}/release`, data);
      toast.success("Loan released — moved to Loan Management");
      onSaved(null);
      onClose();
    } catch (e) {
      toast.error("Failed to release");
    } finally { setSaving(false); }
  };

  // ---- Steps ----
  const Step1 = () => (
    <div className="space-y-4 animate-fade-up">
      <Section title="Group 1 — Application Info">
        <FieldGrid>
          <TextField label="Control No." value={application?.control_no || "AUTO"} onChange={() => {}} disabled />
          <TextField label="Date & Time" value={application?.created_at ? new Date(application.created_at).toLocaleString() : "AUTO"} onChange={() => {}} disabled />
        </FieldGrid>
        <TextField label="Collector's Name" value={data.collector_name || user?.name || ""} onChange={(v) => update({ collector_name: v })} testid="fc-collector-name" />
        <CameraCapture label="Client Photo Verification (2x2)" portrait value={data.client_photo} onChange={(v) => update({ client_photo: v })} testid="cap-client-photo" />
      </Section>

      <Section title="Group 2 — Borrower Full Name">
        <FieldGrid>
          <TextField label="First Name" value={data.first_name} onChange={(v) => update({ first_name: v })} testid="fc-first-name" />
          <TextField label="Middle Name" value={data.middle_name} onChange={(v) => update({ middle_name: v })} testid="fc-middle-name" />
          <TextField label="Surname" value={data.surname} onChange={(v) => update({ surname: v })} testid="fc-surname" />
          <TextField label="Suffix" value={data.suffix} onChange={(v) => update({ suffix: v })} testid="fc-suffix" />
        </FieldGrid>
      </Section>

      <Section title="Group 3 — Contact">
        <FieldGrid>
          <TextField label="Contact No." value={data.contact_no} onChange={(v) => update({ contact_no: v })} testid="fc-contact" />
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">Civil Status</Label>
            <Select value={data.civil_status || ""} onValueChange={(v) => update({ civil_status: v })}>
              <SelectTrigger data-testid="fc-civil-status"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{CIVIL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">Gender</Label>
            <Select value={data.gender || ""} onValueChange={(v) => update({ gender: v })}>
              <SelectTrigger data-testid="fc-gender"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{GENDERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </FieldGrid>
      </Section>

      <Section title="Group 4 — Birth">
        <FieldGrid>
          <TextField label="Date of Birth" type="date" value={data.dob} onChange={(v) => update({ dob: v, age: age(v) })} testid="fc-dob" />
          <TextField label="Age" value={data.dob ? age(data.dob) : ""} onChange={() => {}} disabled />
          <TextField label="Place of Birth" value={data.pob} onChange={(v) => update({ pob: v })} />
        </FieldGrid>
      </Section>

      <Section title="Group 5 — Citizenship & Religion">
        <FieldGrid>
          <TextField label="Citizenship" value={data.citizenship} onChange={(v) => update({ citizenship: v })} />
          <TextField label="Religion" value={data.religion} onChange={(v) => update({ religion: v })} />
        </FieldGrid>
      </Section>

      <Section title="Group 6 — Present Address & Home">
        <Textarea value={data.present_address || ""} onChange={(e) => update({ present_address: e.target.value })} placeholder="Present Address" data-testid="fc-present-address" />
        <FieldGrid>
          <TextField label="Length of Stay" value={data.length_of_stay} onChange={(v) => update({ length_of_stay: v })} />
          <TextField label="Ownership Type" value={data.ownership_type} onChange={(v) => update({ ownership_type: v })} />
        </FieldGrid>
        <CameraCapture label="Present Home (Front View) — with Location" requireLocation value={data.home_photo} onChange={(v) => update({ home_photo: v })} testid="cap-home-photo" />
      </Section>
    </div>
  );

  const Step2 = () => (
    <div className="space-y-4 animate-fade-up">
      <Section title="Valid ID 1">
        <FieldGrid>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">ID Type</Label>
            <Select value={data.id1_type || ""} onValueChange={(v) => update({ id1_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{ID_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <TextField label="ID Number" value={data.id1_number} onChange={(v) => update({ id1_number: v })} />
        </FieldGrid>
        <CameraCapture label="Valid ID 1 (Front)" value={data.id1_photo} onChange={(v) => update({ id1_photo: v })} testid="cap-id1" />
      </Section>

      <Section title="Valid ID 2">
        <FieldGrid>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">ID Type</Label>
            <Select value={data.id2_type || ""} onValueChange={(v) => update({ id2_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>{ID_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <TextField label="ID Number" value={data.id2_number} onChange={(v) => update({ id2_number: v })} />
        </FieldGrid>
        <CameraCapture label="Valid ID 2 (Front)" value={data.id2_photo} onChange={(v) => update({ id2_photo: v })} testid="cap-id2" />
      </Section>

      {[1, 2, 3].map((n) => (
        <Section key={n} title={`Collateral & Appliance — Item ${n}`}>
          <FieldGrid>
            <TextField label="Brand & Model" value={data[`item${n}_brand`]} onChange={(v) => update({ [`item${n}_brand`]: v })} />
            <TextField label="Year Model" value={data[`item${n}_year`]} onChange={(v) => update({ [`item${n}_year`]: v })} />
            <TextField label="Date Purchased" type="date" value={data[`item${n}_date`]} onChange={(v) => update({ [`item${n}_date`]: v })} />
          </FieldGrid>
          <CameraCapture label={`Item ${n} Photo`} value={data[`item${n}_photo`]} onChange={(v) => update({ [`item${n}_photo`]: v })} testid={`cap-item-${n}`} />
        </Section>
      ))}

      <Section title="Co-Makers / Witness">
        <FieldGrid>
          <TextField label="Co-Maker 1 Full Name" value={data.comaker1_name} onChange={(v) => update({ comaker1_name: v })} />
          <TextField label="Co-Maker 1 Address" value={data.comaker1_addr} onChange={(v) => update({ comaker1_addr: v })} />
          <TextField label="Co-Maker 2 Full Name" value={data.comaker2_name} onChange={(v) => update({ comaker2_name: v })} />
          <TextField label="Co-Maker 2 Address" value={data.comaker2_addr} onChange={(v) => update({ comaker2_addr: v })} />
          <TextField label="Witness Full Name" value={data.witness_name} onChange={(v) => update({ witness_name: v })} />
          <TextField label="Witness Address" value={data.witness_addr} onChange={(v) => update({ witness_addr: v })} />
        </FieldGrid>
      </Section>

      <Section title="Business Permit & Store">
        <CameraCapture label="Barangay Business Permit (Front)" portrait value={data.permit_front} onChange={(v) => update({ permit_front: v })} testid="cap-permit-front" />
        <CameraCapture label="Barangay Business Permit (Back)" portrait value={data.permit_back} onChange={(v) => update({ permit_back: v })} testid="cap-permit-back" />
        <CameraCapture label="Business Store (Front View) — with Location" requireLocation value={data.store_photo} onChange={(v) => update({ store_photo: v })} testid="cap-store-photo" />
      </Section>
    </div>
  );

  const Step3 = () => {
    const youngest = data.youngest || [];
    const relatives = data.relatives || [];
    return (
      <div className="space-y-4 animate-fade-up">
        <Section title="Group 1 — Business">
          <FieldGrid>
            <TextField label="Business Type" value={data.bus_type} onChange={(v) => update({ bus_type: v })} />
            <TextField label="Business Address" value={data.bus_addr} onChange={(v) => update({ bus_addr: v })} />
            <TextField label="Length of Business" value={data.bus_length} onChange={(v) => update({ bus_length: v })} />
            <TextField label="Position" value={data.bus_position} onChange={(v) => update({ bus_position: v })} />
            <TextField label="Gross Daily Income" value={data.bus_gross_daily} onChange={(v) => update({ bus_gross_daily: v })} />
            <TextField label="Estimated Capital Investment" value={data.bus_capital} onChange={(v) => update({ bus_capital: v })} />
          </FieldGrid>
        </Section>
        <Section title="Group 2 — If Employed">
          <FieldGrid>
            <TextField label="Company Name" value={data.emp_company} onChange={(v) => update({ emp_company: v })} />
            <TextField label="Address" value={data.emp_address} onChange={(v) => update({ emp_address: v })} />
            <TextField label="Position" value={data.emp_position} onChange={(v) => update({ emp_position: v })} />
            <TextField label="Gross Salary" value={data.emp_salary} onChange={(v) => update({ emp_salary: v })} />
          </FieldGrid>
        </Section>
        <Section title="Group 3 — Spouse Info">
          <FieldGrid>
            <TextField label="Full Name" value={data.spouse_name} onChange={(v) => update({ spouse_name: v })} />
            <TextField label="Contact No." value={data.spouse_contact} onChange={(v) => update({ spouse_contact: v })} />
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">Gender</Label>
              <Select value={data.spouse_gender || ""} onValueChange={(v) => update({ spouse_gender: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{GENDERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <TextField label="Date of Birth" type="date" value={data.spouse_dob} onChange={(v) => update({ spouse_dob: v })} />
            <TextField label="Age" value={data.spouse_dob ? age(data.spouse_dob) : ""} onChange={() => {}} disabled />
            <TextField label="Place of Birth" value={data.spouse_pob} onChange={(v) => update({ spouse_pob: v })} />
            <TextField label="Citizenship" value={data.spouse_citizenship} onChange={(v) => update({ spouse_citizenship: v })} />
            <TextField label="Religion" value={data.spouse_religion} onChange={(v) => update({ spouse_religion: v })} />
          </FieldGrid>
        </Section>
        <Section title="Group 4 — Spouse Business">
          <FieldGrid>
            <TextField label="Business Type" value={data.sp_bus_type} onChange={(v) => update({ sp_bus_type: v })} />
            <TextField label="Business Address" value={data.sp_bus_addr} onChange={(v) => update({ sp_bus_addr: v })} />
            <TextField label="Length of Business" value={data.sp_bus_length} onChange={(v) => update({ sp_bus_length: v })} />
            <TextField label="Position" value={data.sp_bus_position} onChange={(v) => update({ sp_bus_position: v })} />
            <TextField label="Gross Daily Income" value={data.sp_bus_gross} onChange={(v) => update({ sp_bus_gross: v })} />
            <TextField label="Estimated Capital Investment" value={data.sp_bus_capital} onChange={(v) => update({ sp_bus_capital: v })} />
          </FieldGrid>
        </Section>
        <Section title="Group 5 — Spouse If Employed">
          <FieldGrid>
            <TextField label="Company Name" value={data.sp_emp_company} onChange={(v) => update({ sp_emp_company: v })} />
            <TextField label="Address" value={data.sp_emp_address} onChange={(v) => update({ sp_emp_address: v })} />
            <TextField label="Position" value={data.sp_emp_position} onChange={(v) => update({ sp_emp_position: v })} />
            <TextField label="Gross Salary" value={data.sp_emp_salary} onChange={(v) => update({ sp_emp_salary: v })} />
          </FieldGrid>
        </Section>
        <Section title="Group 6 — Youngest Children Going to School">
          {youngest.map((c, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <TextField label="Name" value={c.name} onChange={(v) => { const arr = [...youngest]; arr[idx] = { ...arr[idx], name: v }; update({ youngest: arr }); }} />
              <TextField label="School" value={c.school} onChange={(v) => { const arr = [...youngest]; arr[idx] = { ...arr[idx], school: v }; update({ youngest: arr }); }} />
              <TextField label="Grade / Course" value={c.grade} onChange={(v) => { const arr = [...youngest]; arr[idx] = { ...arr[idx], grade: v }; update({ youngest: arr }); }} />
              <Button variant="outline" type="button" onClick={() => update({ youngest: youngest.filter((_, i) => i !== idx) })}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => update({ youngest: [...youngest, { name: "", school: "", grade: "" }] })}><Plus className="w-4 h-4 mr-1" /> Add Child</Button>
        </Section>
        <Section title="Group 7 — Relatives Not Living With Applicant">
          {relatives.map((r, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
              <TextField label="Name" value={r.name} onChange={(v) => { const arr = [...relatives]; arr[idx] = { ...arr[idx], name: v }; update({ relatives: arr }); }} />
              <TextField label="Grade / Course" value={r.grade} onChange={(v) => { const arr = [...relatives]; arr[idx] = { ...arr[idx], grade: v }; update({ relatives: arr }); }} />
              <TextField label="Age" value={r.age} onChange={(v) => { const arr = [...relatives]; arr[idx] = { ...arr[idx], age: v }; update({ relatives: arr }); }} />
              <Button variant="outline" type="button" onClick={() => update({ relatives: relatives.filter((_, i) => i !== idx) })}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => update({ relatives: [...relatives, { name: "", grade: "", age: "" }] })}><Plus className="w-4 h-4 mr-1" /> Add Relative</Button>
        </Section>
        <Section title="Group 8 — Uploads (optional notes)">
          <FieldGrid>
            <TextField label="New loan upload reference" value={data.new_loan_ref} onChange={(v) => update({ new_loan_ref: v })} />
            <TextField label="Co-makers upload reference" value={data.comaker_ref} onChange={(v) => update({ comaker_ref: v })} />
          </FieldGrid>
        </Section>
        <Section title="Group 9 — Loan Request">
          <FieldGrid>
            <TextField label="Amount Applied" type="number" value={data.amount_applied} onChange={(v) => update({ amount_applied: v })} testid="ba-amount-applied" />
            <TextField label="Terms (days)" type="number" value={data.applied_terms} onChange={(v) => update({ applied_terms: v })} testid="ba-applied-terms" />
          </FieldGrid>
        </Section>
      </div>
    );
  };

  const Step4 = () => {
    const proceeds = calcLoanProceeds({ approved: data.approved_amount, terms: Number(data.approved_terms) });
    return (
      <div className="space-y-4 animate-fade-up">
        <Section title="Group 1 — Approval">
          <FieldGrid>
            <TextField label="Approved Amount" type="number" value={data.approved_amount} onChange={(v) => update({ approved_amount: v })} testid="bm-approved-amount" />
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">Terms</Label>
              <Select value={String(data.approved_terms || "")} onValueChange={(v) => update({ approved_terms: Number(v) })}>
                <SelectTrigger data-testid="bm-approved-terms"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 Days (20% interest)</SelectItem>
                  <SelectItem value="80">80 Days (22% interest)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FieldGrid>
        </Section>
        <Section title="Group 2 — Loan Proceeds Details (computed)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ["Approved Amount", fmt(data.approved_amount)],
              ["Interest Rate", `${(proceeds.interest_rate * 100).toFixed(0)}%`],
              ["Terms", `${data.approved_terms || 0} days`],
              ["Total Loan w/ Interest", fmt(proceeds.total_with_interest)],
              ["Daily Payment", fmt(proceeds.daily_payment)],
              ["Insurance (1%)", fmt(proceeds.insurance)],
              ["Notarial Fee", fmt(proceeds.notarial)],
              ["Released Amount", fmt(proceeds.released)],
            ].map(([l, v]) => (
              <div key={l} className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">{l}</span>
                <span className="text-base font-bold text-slate-900 font-mono">{v}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  };

  const Step5 = () => (
    <div className="space-y-4 animate-fade-up">
      <Section title="Group 1 — Verifier Home Photo">
        <CameraCapture label="Present Home (Front View) — verifier" requireLocation value={data.verifier_home_photo} onChange={(v) => update({ verifier_home_photo: v })} testid="cap-ver-home" />
      </Section>
      <Section title="Group 2 — Verifier Store Photo">
        <CameraCapture label="Business Store (Front View) — verifier" requireLocation value={data.verifier_store_photo} onChange={(v) => update({ verifier_store_photo: v })} testid="cap-ver-store" />
      </Section>
    </div>
  );

  const Step6 = () => (
    <div className="space-y-4 animate-fade-up">
      <Section title="Compare Photos — Collector vs Verifier">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">HOME — Collector</p>
            {data.home_photo?.dataUrl ? <img src={data.home_photo.dataUrl} className="rounded-lg border border-slate-200" alt="" /> : <p className="text-sm text-slate-400">Missing</p>}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">HOME — Verifier</p>
            {data.verifier_home_photo?.dataUrl ? <img src={data.verifier_home_photo.dataUrl} className="rounded-lg border border-slate-200" alt="" /> : <p className="text-sm text-slate-400">Missing</p>}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">STORE — Collector</p>
            {data.store_photo?.dataUrl ? <img src={data.store_photo.dataUrl} className="rounded-lg border border-slate-200" alt="" /> : <p className="text-sm text-slate-400">Missing</p>}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1">STORE — Verifier</p>
            {data.verifier_store_photo?.dataUrl ? <img src={data.verifier_store_photo.dataUrl} className="rounded-lg border border-slate-200" alt="" /> : <p className="text-sm text-slate-400">Missing</p>}
          </div>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm">
          <input type="checkbox" checked={!!data.am_photos_match} onChange={(e) => update({ am_photos_match: e.target.checked })} data-testid="am-photos-match" />
          Confirm photos match (same property)
        </label>
        <Textarea placeholder="Approval notes (optional)" value={data.am_notes || ""} onChange={(e) => update({ am_notes: e.target.value })} className="mt-3" />
      </Section>
    </div>
  );

  const Step7 = () => {
    const start = data.release_date ? new Date(data.release_date) : null;
    const term = Number(data.approved_terms || 0);
    const daily = calcLoanProceeds({ approved: data.approved_amount, terms: term }).daily_payment;
    const rows = [];
    if (start && term > 0) {
      for (let i = 1; i <= term; i++) {
        const d = new Date(start.getTime());
        d.setDate(d.getDate() + i);
        rows.push({ day: i, date: d.toLocaleDateString(), amount: daily });
      }
    }
    return (
      <div className="space-y-4 animate-fade-up">
        <Section title="Group 1 — Schedule">
          <FieldGrid>
            <TextField label="Schedule of Releasing" type="date" value={data.release_date} onChange={(v) => update({ release_date: v })} testid="admin-release-date" />
            <TextField label="Terms (auto)" value={`${term} days`} onChange={() => {}} disabled />
          </FieldGrid>
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold sticky top-0">
                <tr><th className="px-3 py-2 text-left">Day</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-right">Daily Payment</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-400 text-xs">Set release date and terms to preview SOA</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.day} className="border-t border-slate-100"><td className="px-3 py-1.5">{r.day}</td><td className="px-3 py-1.5">{r.date}</td><td className="px-3 py-1.5 text-right font-mono">{fmt(r.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    );
  };

  const Step8 = () => (
    <div className="space-y-4 animate-fade-up">
      <Section title="Group 1 — Disbursement">
        <CameraCapture label="Releasing Proof (Client View) — with Location" requireLocation value={data.release_proof} onChange={(v) => update({ release_proof: v })} testid="cap-release-proof" />
        <CameraCapture label="Loan Contract" portrait value={data.contract_photo} onChange={(v) => update({ contract_photo: v })} testid="cap-contract" />
      </Section>
    </div>
  );

  // Review (read-only) — used by all roles for prior steps
  const Review = () => {
    const list = [];
    list.push({ title: "Step 1 — Application & Borrower",
      fields: [
        ["Control No.", application?.control_no],
        ["Date & Time", application?.created_at ? new Date(application.created_at).toLocaleString() : "—"],
        ["Collector", data.collector_name],
        ["First Name", data.first_name], ["Middle", data.middle_name], ["Surname", data.surname], ["Suffix", data.suffix],
        ["Contact", data.contact_no], ["Civil Status", data.civil_status], ["Gender", data.gender],
        ["Date of Birth", data.dob], ["Age", data.dob ? age(data.dob) : ""], ["Place of Birth", data.pob],
        ["Citizenship", data.citizenship], ["Religion", data.religion],
        ["Present Address", data.present_address], ["Length of Stay", data.length_of_stay], ["Ownership", data.ownership_type],
      ],
      photos: [
        { ...(data.client_photo || {}), label: "Client" },
        { ...(data.home_photo || {}), label: "Home (with location)" },
      ],
    });
    list.push({ title: "Step 2 — IDs, Collateral, Co-Makers",
      fields: [
        ["ID 1", `${data.id1_type || ""} ${data.id1_number || ""}`],
        ["ID 2", `${data.id2_type || ""} ${data.id2_number || ""}`],
        ["Item 1", `${data.item1_brand || ""} (${data.item1_year || ""})`],
        ["Item 2", `${data.item2_brand || ""} (${data.item2_year || ""})`],
        ["Item 3", `${data.item3_brand || ""} (${data.item3_year || ""})`],
        ["Co-Maker 1", `${data.comaker1_name || ""}`],
        ["Co-Maker 2", `${data.comaker2_name || ""}`],
        ["Witness", data.witness_name],
      ],
      photos: [
        { ...(data.id1_photo || {}), label: "ID 1" },
        { ...(data.id2_photo || {}), label: "ID 2" },
        { ...(data.item1_photo || {}), label: "Item 1" },
        { ...(data.item2_photo || {}), label: "Item 2" },
        { ...(data.item3_photo || {}), label: "Item 3" },
        { ...(data.permit_front || {}), label: "Permit Front" },
        { ...(data.permit_back || {}), label: "Permit Back" },
        { ...(data.store_photo || {}), label: "Store (with location)" },
      ],
    });
    if (userStep >= 4) list.push({ title: "Step 3 — Branch Assistant Processing",
      fields: [
        ["Business Type", data.bus_type], ["Business Address", data.bus_addr], ["Length", data.bus_length],
        ["Daily Gross", data.bus_gross_daily], ["Capital", data.bus_capital],
        ["Spouse", data.spouse_name], ["Spouse Contact", data.spouse_contact],
        ["Amount Applied", data.amount_applied], ["Applied Terms", data.applied_terms],
      ],
    });
    if (userStep >= 5) {
      const p = calcLoanProceeds({ approved: data.approved_amount, terms: Number(data.approved_terms) });
      list.push({ title: "Step 4 — Branch Manager Approval",
        fields: [
          ["Approved", fmt(data.approved_amount)], ["Terms", `${data.approved_terms || 0} days`],
          ["Interest", `${(p.interest_rate * 100).toFixed(0)}%`], ["Total w/ Interest", fmt(p.total_with_interest)],
          ["Daily Payment", fmt(p.daily_payment)], ["Insurance", fmt(p.insurance)],
          ["Notarial", fmt(p.notarial)], ["Released Amount", fmt(p.released)],
        ],
      });
    }
    if (userStep >= 6) list.push({ title: "Step 5 — Verifier",
      fields: [["Verified", "Yes"]],
      photos: [
        { ...(data.verifier_home_photo || {}), label: "Verifier Home" },
        { ...(data.verifier_store_photo || {}), label: "Verifier Store" },
      ],
    });
    if (userStep >= 7) list.push({ title: "Step 6 — Area Manager",
      fields: [["Photos Match", data.am_photos_match ? "Yes" : "No"], ["Notes", data.am_notes]],
    });
    if (userStep >= 8) list.push({ title: "Step 7 — Admin Schedule",
      fields: [["Release Date", data.release_date]],
    });
    return (
      <div className="space-y-3">
        {list.map((b, i) => <ReviewBlock key={i} {...b} />)}
      </div>
    );
  };

  const renderUserStep = () => {
    // IMPORTANT: call as plain functions, NOT JSX `<StepN />`.
    // Inline arrow components defined inside this parent are recreated each render,
    // which would cause React to unmount/remount inputs on every keystroke.
    switch (userStep) {
      case 1: return Step1();
      case 2: return Step2();
      case 3: return Step3();
      case 4: return Step4();
      case 5: return Step5();
      case 6: return Step6();
      case 7: return Step7();
      case 8: return Step8();
      default: return null;
    }
  };

  // Footer actions per role
  const renderActions = () => {
    if (saving) return <Button disabled>Saving…</Button>;
    if (user.role === "field_collector") {
      if (stepView === 1) {
        return (
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" onClick={() => persist("Draft")} data-testid="fc-step1-draft"><Save className="w-4 h-4 mr-1.5" /> Save as Draft</Button>
            <Button onClick={() => setStepView(2)} className="efcis-gradient text-white" data-testid="fc-step1-next">Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={() => setStepView(1)} data-testid="fc-step2-back"><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
          <Button variant="outline" onClick={() => persist("Draft")} data-testid="fc-step2-draft"><Save className="w-4 h-4 mr-1.5" /> Save as Draft</Button>
          <Button onClick={() => persist("New loan")} className="efcis-gradient text-white" data-testid="fc-step2-save"><CheckCircle2 className="w-4 h-4 mr-1.5" /> Save (New Loan)</Button>
        </div>
      );
    }
    if (user.role === "branch_assistant") return (
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => persist("Draft")}>Save as Draft</Button>
        <Button onClick={() => persist("Processed")} className="efcis-gradient text-white" data-testid="ba-save">Save (Processed)</Button>
      </div>
    );
    if (user.role === "branch_manager") return (
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => persist("Draft")}>Save as Draft</Button>
        <Button onClick={() => persist("Reviewed")} className="efcis-gradient text-white" data-testid="bm-save">Save (Reviewed)</Button>
      </div>
    );
    if (user.role === "verifier") return (
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => persist("Draft")}>Save as Draft</Button>
        <Button onClick={() => persist("Verified")} className="efcis-gradient text-white" data-testid="ver-save">Save (Verified)</Button>
      </div>
    );
    if (user.role === "area_manager") return (
      <div className="flex gap-2 justify-end">
        <Button variant="destructive" onClick={reject} data-testid="am-reject"><XCircle className="w-4 h-4 mr-1.5" /> Reject</Button>
        <Button onClick={() => persist("Approved")} className="efcis-gradient text-white" data-testid="am-approve"><CheckCircle2 className="w-4 h-4 mr-1.5" /> Save (Approved)</Button>
      </div>
    );
    if (user.role === "admin") return (
      <div className="flex gap-2 justify-end">
        <Button onClick={() => persist("Scheduled")} className="efcis-gradient text-white" data-testid="admin-save"><Calendar className="w-4 h-4 mr-1.5" /> Save (Scheduled)</Button>
      </div>
    );
    if (user.role === "releasing_officer") return (
      <div className="flex gap-2 justify-end">
        <Button onClick={release} className="efcis-gradient text-white" data-testid="ro-release"><CheckCircle2 className="w-4 h-4 mr-1.5" /> Save (Released)</Button>
      </div>
    );
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[98vw] max-w-3xl lg:max-w-5xl xl:max-w-6xl max-h-[95vh] overflow-y-auto p-0 sm:rounded-2xl">
        <DialogHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-4">
          <DialogTitle className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2 font-heading">
            <FileText className="w-5 h-5 text-green-600" />
            {isNew ? "Create Loan Application" : `Application • ${application?.control_no}`}
            {application?.status && <span className={`status-pill ml-2 ${STATUS_COLORS[application.status] || "bg-slate-100"}`}>{application.status}</span>}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Step {userStep} of 8 • Role: <span className="font-semibold text-green-700">{user?.role?.replace(/_/g, " ")}</span>
          </DialogDescription>
          {/* Stepper */}
          <div className="flex gap-1 mt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i + 1 <= userStep ? "efcis-gradient" : "bg-slate-200"}`} />
            ))}
          </div>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4">
          {!isNew && user?.role !== "field_collector" && (
            <Tabs defaultValue="form" className="w-full">
              <TabsList className="grid grid-cols-2 w-full max-w-xs">
                <TabsTrigger value="form" data-testid="tab-form">Your Step</TabsTrigger>
                <TabsTrigger value="review" data-testid="tab-review">Previous Steps</TabsTrigger>
              </TabsList>
              <TabsContent value="form" className="mt-4">{renderUserStep()}</TabsContent>
              <TabsContent value="review" className="mt-4">{Review()}</TabsContent>
            </Tabs>
          )}
          {(isNew || user?.role === "field_collector") && renderUserStep()}
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 px-5 py-3 flex flex-wrap items-center gap-2 justify-between">
          <Button variant="ghost" onClick={onClose}><X className="w-4 h-4 mr-1.5" /> Close</Button>
          {renderActions()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
