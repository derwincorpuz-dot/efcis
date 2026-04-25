import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("efcis_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const ROLES = {
  admin: "Admin",
  field_collector: "Field Collector",
  branch_assistant: "Branch Assistant",
  branch_manager: "Branch Manager",
  verifier: "Verifier",
  area_manager: "Area Manager",
  releasing_officer: "Releasing Officer",
};

export const STATUS_COLORS = {
  Draft: "bg-slate-100 text-slate-700 border border-slate-200",
  "New loan": "bg-blue-50 text-blue-700 border border-blue-200",
  Processed: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  Reviewed: "bg-purple-50 text-purple-700 border border-purple-200",
  Verified: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  Approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border border-red-200",
  Scheduled: "bg-amber-50 text-amber-700 border border-amber-200",
  Released: "bg-green-100 text-green-800 border border-green-300",
  Ongoing: "bg-green-50 text-green-700 border border-green-200",
};

export const ROLE_ACTION = {
  field_collector: { label: "Continue", needsStep: 1 },
  branch_assistant: { label: "Process", needsStep: 3 },
  branch_manager: { label: "Review", needsStep: 4 },
  verifier: { label: "Verify", needsStep: 5 },
  area_manager: { label: "Approval", needsStep: 6 },
  admin: { label: "Schedule", needsStep: 7 },
  releasing_officer: { label: "Disbursement", needsStep: 8 },
};
