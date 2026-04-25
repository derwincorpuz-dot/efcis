import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Save, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [logo, setLogo] = useState(null);
  const [systemName, setSystemName] = useState("EFCIS LMS");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => {
      setLogo(r.data?.logo_data_url || null);
      setSystemName(r.data?.system_name || "EFCIS LMS");
    });
  }, []);

  if (user?.role !== "admin") {
    return <div className="text-slate-500">Access restricted to admin.</div>;
  }

  const onLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", { logo_data_url: logo, system_name: systemName });
      toast.success("Settings saved");
    } catch (e) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl animate-fade-up">
      <Card className="p-6 border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 font-heading">Branding</h3>
        <p className="text-sm text-slate-500 mt-1">Upload your system logo and customize display name.</p>

        <div className="mt-6 space-y-5">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Logo (2x2 inch)</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl efcis-gradient flex items-center justify-center overflow-hidden shadow-md shadow-green-500/25">
                {logo ? <img src={logo} alt="Logo" className="w-full h-full object-cover" /> : <ShieldCheck className="w-10 h-10 text-white" />}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" data-testid="settings-logo-upload" />
                <span className="inline-flex items-center gap-2 px-4 h-10 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Upload className="w-4 h-4" /> Upload Logo
                </span>
              </label>
              {logo && (
                <button onClick={() => setLogo(null)} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">System Name</Label>
            <Input value={systemName} onChange={(e) => setSystemName(e.target.value)} className="mt-2" data-testid="settings-system-name" />
          </div>

          <Button onClick={save} disabled={saving} className="efcis-gradient text-white" data-testid="settings-save">
            <Save className="w-4 h-4 mr-1.5" /> {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
