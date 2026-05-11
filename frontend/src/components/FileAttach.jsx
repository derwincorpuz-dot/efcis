import React from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText as FileIcon } from "lucide-react";

/**
 * FileAttach — for uploading images or PDFs as base64 data-URLs.
 * value: { dataUrl, name, type, size } | null
 */
export default function FileAttach({ label = "Attach file", accept = "image/*,application/pdf", value, onChange, testid = "file-attach" }) {
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ dataUrl: reader.result, name: f.name, type: f.type, size: f.size });
    reader.readAsDataURL(f);
  };

  return (
    <div className="w-full" data-testid={testid}>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 block">{label}</span>
      {value?.dataUrl ? (
        <div className="border border-slate-200 rounded-xl bg-slate-50 p-3 flex items-center gap-3">
          {value.type?.startsWith("image/") ? (
            <img src={value.dataUrl} alt={value.name} className="w-16 h-16 object-cover rounded-md border border-slate-200" />
          ) : (
            <div className="w-16 h-16 rounded-md bg-white border border-slate-200 flex items-center justify-center">
              <FileIcon className="w-7 h-7 text-slate-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800 truncate">{value.name}</div>
            <div className="text-[11px] text-slate-500">{Math.round((value.size || 0) / 1024)} KB</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => onChange(null)} data-testid={`${testid}-remove`}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <label className="cursor-pointer block">
          <input type="file" accept={accept} onChange={onFile} className="hidden" data-testid={`${testid}-input`} />
          <div className="border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Upload className="w-4 h-4" /> Click to upload
          </div>
        </label>
      )}
    </div>
  );
}
