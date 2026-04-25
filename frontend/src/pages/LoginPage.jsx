import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    api.get("/settings").then((r) => setLogo(r.data?.logo_data_url || null)).catch(() => {});
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await login(email.trim(), password);
    setLoading(false);
    if (!res.ok) toast.error(res.error || "Login failed");
    else toast.success("Welcome back");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center login-bg p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-green-300/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-300/30 rounded-full blur-3xl" />
      </div>

      <form
        onSubmit={onSubmit}
        data-testid="login-form"
        className="relative w-full max-w-md bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl p-8 animate-fade-up"
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="w-[96px] h-[96px] rounded-2xl efcis-gradient flex items-center justify-center shadow-lg shadow-green-500/30 overflow-hidden"
            data-testid="login-logo"
          >
            {logo ? (
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ShieldCheck className="w-12 h-12 text-white" strokeWidth={2.2} />
            )}
          </div>
          <h1 className="mt-5 text-2xl font-extrabold text-slate-900 font-heading tracking-tight">
            EFCIS LMS
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-xs">
            Easy Finance Credit Investigation Services<br/>Loan Management System
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              data-testid="login-email-input"
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="login-password-input"
                className="h-11 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                tabIndex={-1}
                data-testid="login-password-toggle"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            data-testid="login-submit-button"
            className="w-full h-11 efcis-gradient text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-green-500/40 transition-all duration-200"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Log in
          </Button>
        </div>

        <div className="mt-8 pt-5 border-t border-slate-100 text-center">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-semibold">
            Developed by
          </p>
          <p className="mt-1 text-sm font-bold text-slate-700">Darwin IT Dev</p>
        </div>
      </form>
    </div>
  );
}
